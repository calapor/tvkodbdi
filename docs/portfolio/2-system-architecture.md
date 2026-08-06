# 2 — System Architecture

## Diagram

The full request/aggregation flow is defined as PlantUML in [`../diagrams/architecture.puml`](../diagrams/architecture.puml). Render it with:

```bash
plantuml docs/diagrams/architecture.puml
```

## Request flow

```
Browser (React 19 SPA)
  └── GET /api/user/*  ──►  Nginx :80 (static build + reverse proxy)
                              └── strip /api  ──►  Express :3000 (backend)
                                                     ├── serveWithCache (file TTL cache)
                                                     └── runPool (bounded concurrency)
                                                           ├── TheTVDB v4 API
                                                           ├── TMDb API
                                                           └── Kodi JSON-RPC (LAN)
```

Two containers make up the deployment:

- **Frontend container** — Nginx serving the static React build and reverse-proxying `/api/*` to the backend ([`../../frontend/nginx.conf`](../../frontend/nginx.conf)).
- **Backend container** — Node.js + Express ([`../../backend/src/server.js`](../../backend/src/server.js)) that holds all credentials and aggregates the three upstream sources.

**The browser never calls an upstream API directly.** Every data request is `/api/...`; Nginx rewrites `^/api/(.*)$ → /$1` and proxies to `tvkodbdi-backend-service:3000`. This keeps API keys server-side and keeps Kodi (which lives on the private LAN) unreachable from the browser.

## Endpoints

The backend exposes exactly three routes:

| Route | Purpose | Sources joined |
|---|---|---|
| `GET /user/favorites` | Favourite series with last/next aired episodes | TheTVDB + Kodi |
| `GET /user/lastplayed` | Recently-played shows + next unwatched episode + runtime | Kodi + TheTVDB + TMDb |
| `GET /user/kodirefresh` | Fire-and-forget Kodi library scan | Kodi |

`/user/favorites` and `/user/lastplayed` are served through the caching layer; `/user/kodirefresh` triggers `VideoLibrary.Scan` and returns `{ status: "OK" }`.

When `DEMO_MODE=true`, the two data endpoints return static payloads from `backend/src/demo/*.json` and make no upstream calls at all.

## Caching strategy — stale-while-revalidate

Implemented by `serveWithCache` in [`../../backend/src/server.js`](../../backend/src/server.js) over the file-backed TTL cache in [`../../backend/src/cache.js`](../../backend/src/cache.js). For each cached endpoint the response states are:

- **HIT** — a fresh entry (within TTL) is returned immediately.
- **STALE** — a fresh-but-aging entry (past `REVALIDATE_AFTER = 0.5` of its TTL) is returned immediately, and a background refresh is kicked off.
- **EXPIRED** — no fresh entry, but an expired one exists: it is returned immediately wrapped in a cache envelope, and a background refresh is started.
- **MISS** — cold cache: compute inline, store, return.
- **error fallback** — if a cold compute throws, any stale entry is served rather than erroring the request.

Background refreshes are de-duplicated through an `inFlightRefresh` map keyed by cache key, so concurrent requests that all trigger a refresh share **one** recompute instead of stampeding the upstream APIs.

Time-relative fields (`daysSinceLastAired`, `daysUntilNextAired`) are recomputed on the way out via `refreshFavoriteDates`, so even a cached payload never shows a stale day count.

Full detail on TTLs and the cache file format is in [`7-caching-and-performance.md`](7-caching-and-performance.md) and [`3-data-model-reference.md`](3-data-model-reference.md).

## Bounded concurrency

Enriching favourites fans out one job per series (TheTVDB series info + episodes, a Kodi match, and an optional TMDb runtime fallback). Rather than a serial loop (slow) or an unbounded `Promise.all` (risks upstream rate-limiting), work runs through a small worker pool — `runPool` in [`../../backend/src/concurrency.js`](../../backend/src/concurrency.js) — with `TVDB_CONCURRENCY = 8` for TheTVDB/TMDb work and `KODI_CONCURRENCY = 6` for Kodi work (Kodi runs on a Pi, so it is kept modest).

## Failure isolation

Per-series enrichment is wrapped in try/catch: a series that 404s or errors upstream is logged and skipped (returns `null`, filtered out), so one bad series never fails the whole response. The TheTVDB and Kodi clients additionally fall back to their own stale cache entries when the upstream is unreachable.

## File-based storage rationale

There is **no database**. The cache is written as two JSON files under `backend/cache/` (`tvdb.json`, `responses.json`). This is a deliberate fit for the data's nature:

- Everything the backend serves is **derived and disposable** — it can always be recomputed from the three upstream sources, so durability guarantees are unnecessary.
- A single-replica backend on a memory-constrained home cluster does not need a network database hop; a local file read/write is faster and has no extra moving part to operate.
- Losing the cache file is harmless: the next request simply computes fresh.

Writes are debounced and coalesced (a 50 ms timer, `unref`'d so it never keeps the process alive) so that the many `set()` calls made while serving one request result in a single non-blocking disk write rather than rewriting the whole file per entry.

The trade-offs of this choice (single replica, no shared cache) are recorded in [`9-engineering-decision-log.md`](9-engineering-decision-log.md).

## Frontend behaviour

The React app ([`../../frontend/src/App.js`](../../frontend/src/App.js), [`../../frontend/src/components/tvkodbdi.js`](../../frontend/src/components/tvkodbdi.js)):

- Renders one route with three tabs (Upcoming / Ended / Active Runtimes).
- Hydrates instantly from `localStorage` (`favorites`, `runtimeData`) so return visits never show a blank loading screen.
- Fetches `/api/user/favorites` and `/api/user/lastplayed` in the background, then writes fresh (non-cached) payloads back to `localStorage`.
- Refreshes on tab-visibility changes and an hourly poll (`POLL_INTERVAL_MS = 3600 * 1000`).
- Shows a **cache banner** when a payload arrives wrapped as `fromCache`, and an **error banner** when a fetch fails and nothing usable is cached.

## Deployment topology

- Two images: `frontend` (Nginx + static build) and `backend` (Node/Express).
- Kubernetes: frontend via NodePort (31080 → 80); backend ClusterIP-only. An optional demo pair runs on NodePort 30091.
- Built for arm64 (Raspberry Pi / k3s); the React build stage runs on the native build platform to avoid slow QEMU emulation.

Deployment detail is in [`8-deployment-architecture.md`](8-deployment-architecture.md).
