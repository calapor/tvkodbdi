# 6 — Security Considerations

tvkodbdi is a single-purpose, self-hosted dashboard intended to run on a private home network / cluster. Its security posture is designed for that context: keep credentials off the browser, keep sensitive services off the public internet, and keep the attack surface small.

## Credential handling

All secrets come from **environment variables only** — nothing is hardcoded. The backend reads them via `dotenv` through [`../../backend/src/config.js`](../../backend/src/config.js) and the individual clients:

| Secret | Where it is used |
|---|---|
| `TVDB_API_KEY` | TheTVDB v4 login (bearer token) |
| `TMDB_API_KEY` | TMDb API authorization header |
| `KODI_HOST` / `KODI_USERNAME` / `KODI_PASSWORD` | Kodi JSON-RPC basic auth |

Handling rules that are actually enforced by the repo:

- **Secrets never reach the browser.** All three integrations are called only from the backend; the frontend talks exclusively to `/api/*` (see [`5-api-integration-deep-dive.md`](5-api-integration-deep-dive.md)). No API key is embedded in the static build.
- **`.env` is gitignored.** Real values live in `backend/src/.env`, which is excluded by [`../../backend/.gitignore`](../../backend/.gitignore) (alongside `cache/`). Only [`../../backend/src/.env.example`](../../backend/src/.env.example) — with placeholder values — is committed.
- **In Kubernetes, credentials are a Secret.** The backend Deployment loads them via `envFrom.secretRef: tvkodbdi-credentials` ([`../../deploy/k8s/backend.yml`](../../deploy/k8s/backend.yml)); the secret is created out-of-band from the `.env` file and is never in the manifests.
- **CI credentials are injected, not committed.** The Jenkins pipeline uses registry / namespace values from Jenkins global env; the demo build path uses no upstream credentials at all (`DEMO_MODE`).

## Network exposure

Exposure is deliberately asymmetric:

- **Backend is not publicly reachable.** In Kubernetes the backend Service is **ClusterIP** ([`../../deploy/k8s/backend.yml`](../../deploy/k8s/backend.yml)) — reachable only from inside the cluster. The only ingress is the frontend.
- **Frontend is the single entry point.** Nginx serves the static build and reverse-proxies `/api/*` to the backend over internal cluster DNS ([`../../frontend/nginx.conf`](../../frontend/nginx.conf)). The browser never addresses the backend, TheTVDB, TMDb, or Kodi directly.
- **Kodi stays on the LAN.** `KODI_HOST` points at a private-network address. Because only the backend calls it, Kodi is never exposed to the browser or the public internet.
- **CORS is closed by default.** The backend enables CORS only for the origins named in `CORS_ORIGIN` (comma-separated); when unset, cross-origin requests are refused (`origin: false`) — appropriate for production where the backend is ClusterIP-only and only proxied same-origin traffic reaches it ([`../../backend/src/server.js`](../../backend/src/server.js)).

## HTTP response hardening

The production Nginx config sets security headers on served responses ([`../../frontend/nginx.conf`](../../frontend/nginx.conf)):

- `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'none'` — clickjacking protection.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- A **Content-Security-Policy** that restricts scripts/styles to `self` and limits image sources to `self`, `https://artworks.thetvdb.com`, and `https://image.tmdb.org` (the two artwork CDNs the UI actually uses), with `connect-src 'self'`.

## The no-authentication decision

The app has **no login and no user accounts** — a deliberate choice, appropriate to its context:

- It is single-tenant and single-purpose: one household's Kodi favourites. There is no multi-user data to segregate and no per-user state on the server (the only client state is the browser's `localStorage`).
- **Access is controlled by placement, not credentials.** Security comes from *where* it is deployed — a private LAN / home cluster reachable only over the local network or a VPN — rather than an app-level auth layer.
- The only write action it can perform is triggering a Kodi library scan (`VideoLibrary.Scan`); it cannot modify media, watched state, or user data. The blast radius of unauthenticated access on a trusted network is therefore minimal.

### When this is appropriate — and when it is not

This model is sound **only** on a trusted network. It is explicitly **not** suitable for exposing the frontend NodePort to the public internet: there is no auth to stop an attacker on the network path from reading your library data or triggering scans, and the CSP/headers do not substitute for authentication. If public exposure were ever required, it should be fronted by an authenticating reverse proxy or VPN — that is out of scope for the project as built.
