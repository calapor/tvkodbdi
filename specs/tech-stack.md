# Tech Stack & Conventions

## Backend
- Node.js + Express (`backend/src/server.js`)
- `dayjs` for date math, `dotenv` for configuration, `cors` for the dev server
- Dedicated clients per source: `thetvdb-client.js`, `thetmdb-client.js`,
  `kodi-client.js`
- Cross-cutting helpers: `cache.js` (file-based TTL cache), `concurrency.js`
  (bounded worker pool), `config.js` (env-var config)
- All credentials come from environment variables — nothing is hardcoded

## Frontend
- React 19 via Create React App (`react-scripts`)
- `react-router-dom` for routing
- Served in production by Nginx, which proxies `/api/*` to the backend
- Build-time configuration via `REACT_APP_*` env vars (baked into the static build)

## Infrastructure
- Docker (multi-stage frontend build: build on native platform, run on arm64)
- Kubernetes / k3s (`deploy/k8s/*.yml`), templated with `envsubst`
- Jenkins pipeline (`Jenkinsfile`) using a Kubernetes pod agent with `node`,
  `kaniko`, and `kubectl` containers
- Kaniko for in-cluster image builds; pnpm workspace for install/build/test

## Build-time configuration (frontend)
| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_SHOW_DOWNLOADED_COL` | `false` | Show the "Last Downloaded Episode" column |
| `REACT_APP_SEARCH_LINK_1` | `http://localhost/search.php?q=` | First double-click search URL |
| `REACT_APP_SEARCH_LINK_2` | `http://127.0.0.1/search.php?q=` | Second double-click search URL |
| `REACT_APP_BACKEND_URL` | _(empty)_ | Override the backend URL baked into the build |
| `REACT_APP_VERSION` | `dev` | Build version shown in the bottom-right badge |

These are wired as Docker build args (`frontend/Dockerfile`), overridable locally
via `docker-compose.yml`, and exposed as Jenkins parameters. In CI they also feed
a config hash so a parameter change forces a new image and redeploy.

## Conventions
- Keep secrets out of the repo: real values live in `backend/src/.env`
  (gitignored); `backend/src/.env.example` documents the required keys with
  placeholders.
- No direct upstream API calls from the browser — everything goes through the
  backend proxy.
- Prefer bounded concurrency and cache-first responses over blocking upstream
  calls on the request path.
