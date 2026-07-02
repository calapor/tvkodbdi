# Architecture

## Request flow
```
Browser
  └── React frontend (Nginx, port 80)
        └── /api/* proxy → Node/Express backend (port 3000)
                              ├── TheTVDB API
                              ├── TMDb API
                              └── Kodi JSON-RPC
```

- The browser never calls upstream APIs directly. Nginx proxies every `/api/*`
  request to the backend, which holds all credentials.
- The backend exposes three endpoints (`/user/favorites`, `/user/lastplayed`,
  `/user/kodirefresh`) and aggregates the three upstream sources per request.
- There is no database. Responses are cached as JSON files under `backend/cache/`.

## Caching strategy (stale-while-revalidate)
Implemented in `backend/src/server.js` (`serveWithCache`) over a file-backed TTL
cache (`backend/src/cache.js`):

- **Fresh hit** → return immediately (`cache=HIT`).
- **Aging hit** → once an entry passes `REVALIDATE_AFTER` (0.5) of its TTL, it is
  still returned instantly but a background refresh is kicked off (`cache=STALE`).
- **Expired entry present** → return it immediately wrapped in a cache envelope and
  refresh in the background (`cache=EXPIRED`).
- **Cold cache** → compute inline (`cache=MISS`).
- **Compute throws** → fall back to any stale entry rather than erroring.

Background refreshes are de-duplicated via an `inFlightRefresh` map keyed by cache
key, so concurrent requests share a single recompute instead of stampeding.

Time-relative fields (days since / until air) are recomputed on the way out
(`refreshFavoriteDates`) so cached payloads never show stale day counts.

## Bounded concurrency
Enriching favourites fans out one job per series (TheTVDB series info + episodes,
Kodi match, TMDb fallback). To run fast without triggering upstream rate limits,
work is executed through a bounded worker pool (`backend/src/concurrency.js`
`runPool`, `TVDB_CONCURRENCY = 8`) instead of a serial loop or an unbounded
`Promise.all`.

## Failure isolation
Per-series enrichment is wrapped in try/catch: a series that 404s or errors is
logged and skipped, so one bad series never fails the whole response.

## Frontend behaviour
- React 19 (CRA) with `react-router`: landing at `/`, dashboard at `/tvkodbdi`.
- On load the dashboard hydrates from `localStorage`, then fetches live data,
  refreshing on tab-visibility changes and an hourly poll.
- Fresh (non-cached) payloads are written back to `localStorage`.

## Deployment topology
- Two images: `frontend` (Nginx + static build) and `backend` (Node/Express).
- Kubernetes: frontend exposed via NodePort (31080 → 80); backend is ClusterIP.
- Nginx resolves the backend through Kubernetes internal DNS.
- Built for arm64 (Raspberry Pi / k3s); the React build stage runs on the native
  build platform to avoid slow QEMU emulation.
