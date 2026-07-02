![tvkodbdi — media tracker & reminders](docs/tvkodbdi_white.jpg)

# TheTVDBKodi

A self-hosted web dashboard that tracks your favourite TV shows by aggregating data from [TheTVDB](https://thetvdb.com), [TMDb](https://www.themoviedb.org), and your local [Kodi](https://kodi.tv) library. It shows upcoming episodes, recently aired episodes, ended shows, and active episode runtimes for shows in your Kodi favourites.

> 📚 Project documentation lives in [`specs/`](specs/): [product overview](specs/product-overview.md), [user flows](specs/user-flows.md), [data models](specs/data-models.md), [architecture](specs/architecture.md), and [tech stack](specs/tech-stack.md).

## Architecture

```
Browser
  └── React frontend (Nginx, port 80)
        └── /api/* proxy → Node/Express backend (port 3000)
                              ├── TheTVDB API
                              ├── TMDb API
                              └── Kodi JSON-RPC
```

- **Frontend**: React 19 (Create React App), served by Nginx. All `/api/*` requests are proxied to the backend — no direct API calls from the browser.
- **Backend**: Node.js + Express. Aggregates data from three sources, applies a file-based TTL cache (stale-while-revalidate), and exposes three API endpoints.
- **No database**: cache is stored as JSON files on the backend pod's filesystem (`backend/cache/`).

## Prerequisites

| Requirement | Notes |
|---|---|
| TheTVDB API key | Register at [thetvdb.com](https://thetvdb.com) → Account → API Keys |
| TMDb API key | Register at [themoviedb.org](https://www.themoviedb.org/settings/api) |
| Kodi with JSON-RPC | Enable via Settings → Services → Control → Allow remote control via HTTP |

## Environment variables

All five variables are required. Copy `backend/src/.env.example` to `backend/src/.env` and fill in your values.

| Variable | Description |
|---|---|
| `TVDB_API_KEY` | TheTVDB v4 API key |
| `TMDB_API_KEY` | TMDb API read-access token |
| `KODI_HOST` | Full JSON-RPC URL, e.g. `http://192.168.1.10:8080/jsonrpc` |
| `KODI_USERNAME` | Kodi HTTP username (default: `xbmc`) |
| `KODI_PASSWORD` | Kodi HTTP password (default: `xbmc`) |

## Local development

```bash
# Start both services
docker compose up

# Frontend available at http://localhost:80
# Backend available at http://localhost:3000
```

For frontend hot-reload development:

```bash
cd frontend && npm start   # dev server on port 3000, proxies /api to localhost:3000
cd backend  && node src/server.js
```

## Kubernetes deployment

### 1. Build and push images

Replace `your-registry` with your container registry host (e.g. `ghcr.io/youruser` or a local registry).

```bash
# Backend
docker buildx build \
  --platform linux/arm64 \
  -t your-registry/thetvdbkodi/backend:latest \
  --push ./backend

# Frontend
docker buildx build \
  --platform linux/arm64 \
  -t your-registry/thetvdbkodi/frontend:latest \
  --push ./frontend
```

### 2. Create the credentials secret

```bash
kubectl create namespace thetvdbkodi
kubectl create secret generic tvkodbdi-credentials \
  --from-env-file=backend/src/.env \
  -n thetvdbkodi
```

### 3. Deploy

Update the `image:` fields in `deploy/k8s/backend.yml` and `deploy/k8s/frontend.yml` with your registry path, then:

```bash
kubectl apply -f deploy/k8s/ -n thetvdbkodi
```

The frontend is exposed on **NodePort 31080**. The backend is ClusterIP-only (internal to the cluster).

### Kubernetes manifest overview

| File | Service | Type | Port |
|---|---|---|---|
| `deploy/k8s/frontend.yml` | `tvkodbdi-frontend-service` | NodePort | 31080 → 80 |
| `deploy/k8s/backend.yml` | `tvkodbdi-backend-service` | ClusterIP | 3000 |

The frontend Nginx config at `frontend/nginx.conf` proxies `/api/*` requests to `tvkodbdi-backend-service.default.svc.cluster.local:3000` using Kubernetes internal DNS. If you deploy to a namespace other than `default`, update the resolver address in `nginx.conf`.

## CI/CD (Jenkins)

The `Jenkinsfile` uses a Kubernetes pod agent with three containers: `node` (build/test), `kaniko` (image build), and `kubectl` (deploy).

**Pipeline stages:**

| Stage | Runs on | What it does |
|---|---|---|
| Setup | all branches | Set `IMAGE_TAG` from git SHA, enable pnpm |
| Install | all branches | `pnpm install --frozen-lockfile` |
| Verify | all branches | Build frontend, run tests |
| Build & push images | `main` only | Kaniko builds `frontend` and `backend` images |
| Deploy | `main` only | `envsubst` + `kubectl apply`, waits for rollout |

**Required cluster setup:**

1. A `jenkins-deployer` ServiceAccount with permission to create/update Deployments and Services in the `thetvdbkodi` namespace.
2. The `tvkodbdi-credentials` secret (see step 2 above) must exist before the first deploy.
3. Set `REGISTRY` in the `Jenkinsfile` environment block to your registry host.
4. For a local HTTP registry: add `--insecure --skip-tls-verify` to the Kaniko executor calls and configure each cluster node to allow the insecure registry.

## Build-time feature flags

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_SHOW_DOWNLOADED_COL` | `false` | Set to `true` to show the "Last Downloaded Episode" column in all tables |
| `REACT_APP_SEARCH_LINK_1` | `http://localhost/search.php?q=` | First search URL toggled by double-clicking a table |
| `REACT_APP_SEARCH_LINK_2` | `http://127.0.0.1/search.php?q=` | Second search URL toggled by double-clicking a table |
| `REACT_APP_BACKEND_URL` | _(empty)_ | Override the backend URL baked into the frontend build |

Pass as `--build-arg` when building the Docker image:

```bash
docker buildx build \
  --build-arg REACT_APP_SHOW_DOWNLOADED_COL=true \
  -t your-registry/thetvdbkodi/frontend:latest \
  --push ./frontend
```

## UI features

- **Double-click to toggle search link** — the ⚠️ warning icon on shows that are behind on downloads links to a configurable search URL. Double-click anywhere in the table to switch between the two search URLs. These are set at build time via `REACT_APP_SEARCH_LINK_1` / `REACT_APP_SEARCH_LINK_2` (see the feature-flags table above), so you can point them at your preferred search endpoint without changing code. They fall back to the localhost defaults in `frontend/src/utils/common.js` when unset.
- **Kodi Refresh button** — the Kodi icon in the bottom-left triggers a Kodi library scan via the backend.

## License

Released under the [MIT License](LICENSE).
