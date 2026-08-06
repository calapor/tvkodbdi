# 8 — Deployment Architecture

tvkodbdi ships as two container images — a Node/Express **backend** and an Nginx-served React **frontend** — deployed to a Kubernetes (k3s) cluster on arm64 hardware. A local Docker Compose setup mirrors the same two-service topology for development.

## Local development — Docker Compose

[`../../docker-compose.yml`](../../docker-compose.yml) runs both services:

- **backend** — built from `./backend`, exposed on `3000`, with the source bind-mounted for iteration.
- **frontend** — built from `./frontend`, exposed on `80`, `depends_on: backend`. The two search-URL build args (`REACT_APP_SEARCH_LINK_1/2`) are overridable at build time without a code change.

```bash
docker compose up          # frontend :80, backend :3000
```

For frontend hot-reload, the CRA dev server proxies `/api` to `localhost:3000` via [`../../frontend/src/setupProxy.js`](../../frontend/src/setupProxy.js), so the same `/api/*` contract holds in dev and prod.

## Container images

### Backend — [`../../backend/Dockerfile`](../../backend/Dockerfile)

A straightforward `node:18` image. Because it may be built under QEMU arm64 emulation, npm is configured for resilience (`maxsockets=1`, generous fetch retries/timeouts) and `npm install` is wrapped in a retry loop, since emulated builds otherwise drop parallel TLS connections to the registry.

### Frontend — [`../../frontend/Dockerfile`](../../frontend/Dockerfile) (multi-stage)

The key detail is the **split build platform**:

- The **build stage** runs on `--platform=$BUILDPLATFORM` (the native builder, e.g. amd64). The React build only emits static HTML/JS/CSS, which is architecture-independent, so building natively avoids slow and flaky QEMU emulation of the whole npm/React toolchain.
- The **runtime stage** is `nginx:alpine` built for the target arch (arm64). It copies the static build into the Nginx web root and installs the chosen Nginx config.

Build-time configuration is passed as Docker build args and baked into the static bundle: `REACT_APP_SHOW_DOWNLOADED_COL`, `REACT_APP_SEARCH_LINK_1/2`, `REACT_APP_BACKEND_URL`, `REACT_APP_DEMO`, and `REACT_APP_VERSION`. The Nginx config file is itself an arg (`NGINX_CONF`), which is how the demo variant swaps in `nginx-demo.conf`.

### arm64 build commands

For a manual `buildx` build (see [`../../docs/BuildInstructions.txt`](../../docs/BuildInstructions.txt)):

```bash
docker buildx build --platform linux/arm64 \
  -t your-registry/thetvdbkodi/backend:latest --push ./backend

docker buildx build --platform linux/arm64 \
  --build-arg REACT_APP_BACKEND_URL=http://tvkodbdi-backend.default.svc.cluster.local:3000 \
  -t your-registry/thetvdbkodi/frontend:latest --push ./frontend
```

A local insecure registry (`registry:2` on `:5000`) is used for the home cluster; the build-instructions file documents starting it.

## Nginx reverse proxy

The production config [`../../frontend/nginx.conf`](../../frontend/nginx.conf):

- Serves the SPA (`try_files $uri /index.html`).
- Proxies `location /api/` to the backend, rewriting `^/api/(.*)$ → /$1` so the backend sees clean paths.
- Resolves the backend through **Kubernetes internal DNS** (`resolver 10.43.0.10`, upstream `tvkodbdi-backend-service.default.svc.cluster.local:3000`). Using a `resolver` + variable upstream means Nginx does not fail to start if the backend is not yet resolvable.
- Sets generous proxy timeouts (180 s) so slow cold-cache aggregations are not cut off, and serves `maintenance.html` on 502/503/504.
- Sets the security headers / CSP described in [`6-security-considerations.md`](6-security-considerations.md).

If deployed to a namespace other than `default`, the upstream hostname in `nginx.conf` must be updated.

## Kubernetes topology

Manifests live in [`../../deploy/k8s/`](../../deploy/k8s/). The image fields use `${REGISTRY}/${IMAGE_REPO}/...:${IMAGE_TAG}` placeholders resolved by `envsubst` in CI.

| Manifest | Workload | Service type | Port |
|---|---|---|---|
| `frontend.yml` | `tvkodbdi-frontend` | NodePort | 31080 → 80 |
| `backend.yml` | `tvkodbdi-backend` | ClusterIP | 3000 |
| `frontend-demo.yml` | `tvkodbdi-demo-frontend` | NodePort | 30091 → 80 |
| `backend-demo.yml` | `tvkodbdi-demo-backend` | ClusterIP | 3000 |

Details:

- **Frontend** is the only externally-reachable component (NodePort). It has a readiness probe on `/` and a `maxUnavailable: 0 / maxSurge: 1` rolling update so there is no downtime on deploy.
- **Backend** is ClusterIP-only and loads credentials from the `tvkodbdi-credentials` Secret via `envFrom.secretRef`. The Secret is created out-of-band from the `.env` file:

  ```bash
  kubectl create secret generic tvkodbdi-credentials --from-env-file=backend/src/.env
  ```

- **Demo pair** runs the same images with `DEMO_MODE=true` on the backend (serving static `demo/*.json`) and the demo Nginx config on the frontend, exposed on NodePort 30091. It makes no upstream calls and needs no credentials.

## CI/CD pipeline

Two pipelines are wired up (expanded in [`4-testing-strategy.md`](4-testing-strategy.md) and the top-level README):

- **GitHub Actions** ([`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) runs the test suites on every push / PR to `main`.
- **Jenkins** ([`../../Jenkinsfile`](../../Jenkinsfile)) runs on a Kubernetes pod agent with `node`, `kaniko`, and `kubectl` containers, sized deliberately small for a memory-constrained (~3.7 Gi/node) home cluster. On `main`: install → verify (build + tests) → **Kaniko** builds and pushes the backend and frontend images in-cluster → **kubectl** `envsubst`s the manifests and applies them, waiting for the rollout. The frontend search-URL config is hashed so a parameter change forces a fresh image tag and redeploy. The demo instance is an opt-in parameter (`DEPLOY_DEMO`).

Kaniko is used for image builds because it builds container images inside the cluster without a Docker daemon — a good fit for a Jenkins agent running as an unprivileged pod. For the local insecure registry, `KANIKO_EXTRA_ARGS` carries `--insecure --skip-tls-verify`.
