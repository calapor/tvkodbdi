![tvkodbdi — media tracker & reminders](docs/tvkodbdi_white.jpg)

[![CI](https://github.com/calapor/tvkodbdi/actions/workflows/ci.yml/badge.svg)](https://github.com/calapor/tvkodbdi/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/github/checks-status/calapor/tvkodbdi/main?check=test&label=tests&logo=vitest)](https://github.com/calapor/tvkodbdi/actions/workflows/ci.yml)

# TheTVDBKodi (tvkodbdi)

A self-hosted web dashboard that tracks your favourite TV shows by aggregating data from [TheTVDB](https://thetvdb.com), [TMDb](https://www.themoviedb.org), and your local [Kodi](https://kodi.tv) library into a single "what do I watch next" view.

> ### 📚 Portfolio documentation
> This project ships a full engineering portfolio: problem framing, architecture, data model, testing, API integration, security, caching, deployment, and a decision log.
> **Start here → [`docs/portfolio/README.md`](docs/portfolio/README.md)**

## Features

- **Unified favourites dashboard** — one table of your Kodi favourite series with last-aired and next-aired episode details (season/episode, air date, days since / until air).
- **Ended-shows view** — favourites whose status is ended, separated from active shows.
- **Active show runtimes** — recently-played shows with the next unwatched episode and its runtime (from Kodi, falling back to TMDb when Kodi has no runtime).
- **Behind-on-downloads helper** — a ⚠️ indicator marks shows you are behind on; double-clicking a table toggles between two build-time-configurable search URLs so you can jump to a search backend of your choice.
- **Kodi library scan** — a button in the UI triggers a Kodi `VideoLibrary.Scan` via the backend.
- **Cache-first responses** — a file-based TTL cache with stale-while-revalidate keeps the dashboard responsive even when an upstream API is slow or down; a banner is shown when data is served from cache.
- **Offline-friendly frontend** — the dashboard hydrates instantly from `localStorage`, then refreshes in the background on tab-visibility changes and an hourly poll.
- **Demo mode** — a static-data instance (`DEMO_MODE=true`) that serves canned payloads with no Kodi / TheTVDB / TMDb calls.
- **No login** — access is controlled by where you deploy it (home LAN / cluster).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Create React App), `react-router-dom` |
| Frontend serving | Nginx (static build + `/api/*` reverse proxy) |
| Backend | Node.js + Express 5 |
| HTTP / dates | `axios`, `dayjs` |
| Config | `dotenv` (environment variables only) |
| Cache | File-based JSON TTL cache — no database |
| External data | TheTVDB v4 API, TMDb API, Kodi JSON-RPC |
| Packaging | Docker (multi-stage), pnpm workspace |
| Orchestration | Kubernetes / k3s (arm64) |
| CI/CD | GitHub Actions (tests), Jenkins + Kaniko (build & deploy) |
| Tests | Jest / React Testing Library (frontend); Jest + Supertest (backend) |

## Prerequisites

| Requirement | Notes |
|---|---|
| TheTVDB API key | Register at [thetvdb.com](https://thetvdb.com) → Account → API Keys (v4) |
| TMDb API key | Read-access token from [themoviedb.org](https://www.themoviedb.org/settings/api) |
| Kodi with JSON-RPC | Enable via Settings → Services → Control → Allow remote control via HTTP |
| Node.js 20+ / pnpm | For local development and running tests |
| Docker (+ buildx) | For building images / running via Docker Compose |

## Environment variables

Copy `backend/src/.env.example` to `backend/src/.env` and fill in your values.

| Variable | Required | Description |
|---|---|---|
| `TVDB_API_KEY` | yes | TheTVDB v4 API key |
| `TMDB_API_KEY` | yes | TMDb API read-access token |
| `KODI_HOST` | yes | Full JSON-RPC URL, e.g. `http://192.168.1.10:8080/jsonrpc` |
| `KODI_USERNAME` | yes | Kodi HTTP username (default: `xbmc`) |
| `KODI_PASSWORD` | yes | Kodi HTTP password (default: `xbmc`) |
| `CORS_ORIGIN` | no | Comma-separated allowed origins for the backend. Set for local dev; leave unset in production (backend is ClusterIP-only). |
| `DEMO_MODE` | no | `true` serves static demo payloads and makes no upstream calls. |

## Getting started (local development)

Run both services with Docker Compose:

```bash
docker compose up
# Frontend  → http://localhost:80
# Backend   → http://localhost:3000
```

For frontend hot-reload against a locally-run backend:

```bash
# terminal 1 — backend (reads backend/src/.env)
cd backend && node src/server.js

# terminal 2 — frontend dev server (proxies /api → localhost:3000 via setupProxy.js)
cd frontend && npm start
```

Run the tests (pnpm workspace):

```bash
pnpm install --frozen-lockfile
pnpm --filter ./frontend exec react-scripts test --watchAll=false   # frontend unit tests
pnpm --filter ./backend run test                                    # backend tests
```

## Architecture

The browser never calls upstream APIs directly. Nginx proxies every `/api/*` request to the Express backend, which holds all credentials and aggregates three sources — TheTVDB, TMDb, and Kodi — per request behind a file-based cache.

See the PlantUML source at [`docs/diagrams/architecture.puml`](docs/diagrams/architecture.puml) and the write-up in [`docs/portfolio/2-system-architecture.md`](docs/portfolio/2-system-architecture.md).

- **Frontend** — React 19, served by Nginx. All `/api/*` requests are proxied to the backend; no direct upstream calls from the browser.
- **Backend** — Node.js + Express. Three endpoints (`/user/favorites`, `/user/lastplayed`, `/user/kodirefresh`), a bounded-concurrency worker pool, and a stale-while-revalidate TTL cache.
- **No database** — cache is stored as JSON files on the backend container's filesystem (`backend/cache/`).

## Project structure

```
.
├── backend/                    # Node.js + Express aggregation API
│   ├── Dockerfile
│   └── src/
│       ├── server.js           # Express app, endpoints, serveWithCache orchestration
│       ├── config.js           # env-var config
│       ├── cache.js            # file-based TTL cache (FileCache, TTL constants)
│       ├── concurrency.js      # runPool bounded worker pool
│       ├── thetvdb-client.js   # TheTVDB v4 auth + series/episode calls
│       ├── thetmdb-client.js   # TMDb episode-runtime fallback
│       ├── kodi-client.js      # Kodi JSON-RPC client
│       ├── demo/               # static payloads used when DEMO_MODE=true
│       └── .env.example        # required environment variables
├── frontend/                   # React 19 (CRA) dashboard
│   ├── Dockerfile              # multi-stage: build on native arch, serve on arm64
│   ├── nginx.conf              # static serving + /api reverse proxy (prod)
│   ├── nginx-demo.conf         # proxy variant for the demo instance
│   └── src/
│       ├── App.js              # router + version badge
│       ├── components/         # dashboard tabs + welcome wizard
│       └── utils/              # slugify, date formatting (+ unit tests)
├── deploy/k8s/                 # Kubernetes manifests (prod + demo)
├── docs/
│   ├── diagrams/               # PlantUML architecture diagram
│   └── portfolio/              # engineering portfolio documents
├── specs/                      # product / architecture / data-model specs
├── Jenkinsfile                 # CI/CD pipeline (Kaniko build + kubectl deploy)
├── .github/workflows/ci.yml    # GitHub Actions test workflow
└── docker-compose.yml          # local dev orchestration
```

## Deployment (Kubernetes)

### 1. Build and push images

Images are built for **arm64** (Raspberry Pi / k3s). The frontend build stage runs on the native build platform to avoid slow QEMU emulation.

```bash
# Backend
docker buildx build --platform linux/arm64 \
  -t your-registry/thetvdbkodi/backend:latest --push ./backend

# Frontend
docker buildx build --platform linux/arm64 \
  -t your-registry/thetvdbkodi/frontend:latest --push ./frontend
```

See [`docs/BuildInstructions.txt`](docs/BuildInstructions.txt) for local-registry notes.

### 2. Create the credentials secret

```bash
kubectl create secret generic tvkodbdi-credentials \
  --from-env-file=backend/src/.env
```

### 3. Deploy

Update the `image:` fields (or set `REGISTRY` / `IMAGE_REPO` / `IMAGE_TAG` for the `envsubst` templating used in CI), then:

```bash
kubectl apply -f deploy/k8s/
```

| File | Service | Type | Port |
|---|---|---|---|
| `deploy/k8s/frontend.yml` | `tvkodbdi-frontend-service` | NodePort | 31080 → 80 |
| `deploy/k8s/backend.yml` | `tvkodbdi-backend-service` | ClusterIP | 3000 |
| `deploy/k8s/frontend-demo.yml` | `tvkodbdi-demo-frontend-service` | NodePort | 30091 → 80 |
| `deploy/k8s/backend-demo.yml` | `tvkodbdi-demo-backend-service` | ClusterIP | 3000 |

The frontend Nginx config proxies `/api/*` to `tvkodbdi-backend-service.default.svc.cluster.local:3000` via Kubernetes internal DNS. If you deploy to a namespace other than `default`, update the upstream in `frontend/nginx.conf`.

## CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`) — on every push / PR to `main`: `pnpm install --frozen-lockfile`, then frontend and backend tests.
- **Jenkins** (`Jenkinsfile`) — a Kubernetes pod agent with `node`, `kaniko`, and `kubectl` containers.

| Stage | Runs on | What it does |
|---|---|---|
| Setup | all branches | Derive `IMAGE_TAG` from git SHA, enable pnpm |
| Install | all branches | `pnpm install --frozen-lockfile` |
| Verify | all branches | Build frontend, run frontend + backend tests |
| Build & push images | `main` only | Kaniko builds `frontend` and `backend` images |
| Deploy | `main` only | `envsubst` + `kubectl apply`, wait for rollout |
| Demo build & deploy | `main` only (opt-in) | Build/deploy a static-data demo instance on NodePort 30091 |

The pipeline hashes the frontend config (search URLs) so a parameter change forces a fresh image and redeploy.

## Build-time feature flags (frontend)

These `REACT_APP_*` values are baked into the static build via Docker build args (`frontend/Dockerfile`), overridable through `docker-compose.yml` or Jenkins parameters.

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_SHOW_DOWNLOADED_COL` | `false` | Show the "Last Downloaded Episode" column in tables |
| `REACT_APP_SEARCH_LINK_1` | `http://localhost/search.php?q=` | First search URL toggled by double-clicking a table |
| `REACT_APP_SEARCH_LINK_2` | `http://127.0.0.1/search.php?q=` | Second search URL toggled by double-clicking a table |
| `REACT_APP_BACKEND_URL` | _(empty)_ | Override the backend URL baked into the build |
| `REACT_APP_DEMO` | `false` | Render the "Demo" badge and (with `DEMO_MODE`) use static data |
| `REACT_APP_VERSION` | `dev` | Build version shown in the bottom-right badge |

```bash
docker buildx build \
  --build-arg REACT_APP_SHOW_DOWNLOADED_COL=true \
  -t your-registry/thetvdbkodi/frontend:latest --push ./frontend
```

## License

Released under the [MIT License](LICENSE).
