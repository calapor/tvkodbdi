# 9 — Engineering Decision Log

Key decisions made building tvkodbdi, each with the reasoning and the trade-off accepted. These reflect the code as it actually stands in the repository.

---

## 1. Aggregate three sources rather than rely on one

**Decision:** Join Kodi (ownership + watched state + external ids), TheTVDB (schedule, status, artwork, finale markers), and TMDb (runtime fallback) per show.

**Why:** No single source answers "what do I watch next / what have I missed". Kodi knows your library but not the upstream schedule; TheTVDB knows the schedule but not what you own; TMDb fills a specific runtime gap. See [`1-pre-development-phase.md`](1-pre-development-phase.md).

**Trade-off:** More integrations to maintain and more failure modes — mitigated with per-source caching, stale fallback, and per-show failure isolation.

---

## 2. Express backend, not Next.js

**Decision:** Build the backend as a plain Node.js + Express service, separate from the React frontend.

**Why:** The backend's job is API aggregation and caching, not server-rendered pages. Express keeps it a thin, dependency-light JSON API with an obvious request lifecycle. The frontend is a static SPA that Nginx can serve directly, so a full-stack framework would add machinery the project does not use.

**Trade-off:** No SSR / unified toolchain; the frontend and backend are built and deployed as two separate images (which is also a benefit — see #4).

---

## 3. File-based cache, not Redis or a database

**Decision:** Persist both the per-source cache and the processed responses as JSON files under `backend/cache/` (`FileCache` in [`../../backend/src/cache.js`](../../backend/src/cache.js)).

**Why:** All cached data is derived and disposable — recomputable from the upstream sources at any time — so durability guarantees are wasted on it. A local file avoids operating a database or Redis on a small home cluster and removes a network hop from the request path.

**Trade-off:** The cache is per-replica and ephemeral (cleared on pod restart). Acceptable because the deployment runs a single backend replica and a cold cache just recomputes. This is the first thing to revisit if the backend is scaled out — see [`7-caching-and-performance.md`](7-caching-and-performance.md).

---

## 4. Separate frontend and backend containers, not a monolith

**Decision:** Ship two images — Nginx+static-build frontend and Express backend — rather than one process serving both.

**Why:** They have different runtimes, scaling characteristics, and — critically — different network exposure. Splitting them lets the frontend be the only NodePort while the backend stays ClusterIP-only, and lets Nginx handle static serving, security headers, and the `/api` proxy natively.

**Trade-off:** Two build pipelines and an internal proxy hop, versus a stronger security boundary and cleaner separation of concerns.

---

## 5. Nginx reverse proxy, not direct backend exposure

**Decision:** The browser only ever calls `/api/*` on the frontend; Nginx proxies to the backend over cluster-internal DNS ([`../../frontend/nginx.conf`](../../frontend/nginx.conf)).

**Why:** Keeps API keys server-side, keeps Kodi (on the private LAN) unreachable from the browser, and gives a single origin for the SPA and its API (simplifying CORS and CSP). The same `/api` contract is honoured in dev via CRA's `setupProxy.js`.

**Trade-off:** An extra proxy hop and DNS-resolver configuration in Nginx, in exchange for a clean security boundary.

---

## 6. Stale-while-revalidate with de-duplicated background refresh

**Decision:** Serve cached responses instantly and refresh out of band once an entry passes half its TTL; collapse concurrent refreshes into one via `inFlightRefresh` (`serveWithCache` in [`../../backend/src/server.js`](../../backend/src/server.js)).

**Why:** The only acceptable slow request is a genuine cold miss. Everything else should be instant, and freshness should be restored without a user waiting — while never letting many concurrent requests stampede the upstream APIs.

**Trade-off:** Users may briefly see slightly stale data (bounded by TTL), and time-relative fields must be recomputed on read to compensate.

---

## 7. Bounded concurrency, not serial and not unbounded

**Decision:** Fan out enrichment through a small worker pool (`runPool`, [`../../backend/src/concurrency.js`](../../backend/src/concurrency.js)) with per-source limits (TheTVDB/TMDb 8, Kodi 6).

**Why:** A serial loop is too slow across dozens of shows; an unbounded `Promise.all` risks upstream rate-limiting and can overwhelm a Pi-hosted Kodi. A bounded pool is the middle ground — fast, but polite to upstreams.

**Trade-off:** A hand-rolled helper (no external dependency) to maintain, chosen over pulling in a concurrency library for ~30 lines of logic.

---

## 8. Lazy TheTVDB auth with transparent 401 retry

**Decision:** Authenticate to TheTVDB on first use, cache the token, and on a 401 re-authenticate once and retry the request ([`../../backend/src/thetvdb-client.js`](../../backend/src/thetvdb-client.js)).

**Why:** Avoids a login round-trip on every request while still handling token expiry gracefully, so an expired token results in a transparent refresh rather than a silent fallback to stale data.

**Trade-off:** Module-level token state (fine for a single-process backend); would need rethinking under horizontal scaling.

---

## 9. TMDb used only as a runtime fallback

**Decision:** Call TMDb solely to fill an episode runtime when Kodi's is missing or zero, preferring the Kodi-supplied `tmdbid` and only falling back to a title search.

**Why:** Kodi is the primary source for local data; TMDb is needed for one specific gap. Scoping it narrowly keeps most requests from touching TMDb at all and avoids depending on fuzzy title matching except as a last resort.

**Trade-off:** The title-search fallback can mis-match ambiguous titles; accepted because it only affects a single derived field and fails soft (returns `null`).

---

## 10. Build React on the native platform, run on arm64

**Decision:** In the frontend Dockerfile, run the build stage on `$BUILDPLATFORM` and only the runtime (Nginx) stage on the arm64 target ([`../../frontend/Dockerfile`](../../frontend/Dockerfile)).

**Why:** The React build output is architecture-independent static assets, so there is no reason to run the heavy npm/React toolchain under slow, flaky QEMU emulation. The backend, which must run its Node runtime on arm64, hardens npm instead (retries, `maxsockets=1`).

**Trade-off:** A slightly more complex multi-stage/multi-platform Dockerfile, in exchange for dramatically faster, more reliable frontend builds.

---

## 11. Kaniko in-cluster builds via Jenkins

**Decision:** Build and push images with Kaniko inside the Jenkins Kubernetes pod agent ([`../../Jenkinsfile`](../../Jenkinsfile)), with tests gating every branch.

**Why:** Kaniko builds images without a Docker daemon, which suits an unprivileged Jenkins agent pod on a home cluster. Running tests + frontend build on all branches (but only building/pushing/deploying on `main`) keeps feedback fast while protecting the deployed environment.

**Trade-off:** Kaniko caching quirks and cluster memory constraints require tuning (small resource requests, `--compressed-caching=false`), versus the simplicity of a privileged Docker build.

---

## 12. No authentication; a static demo mode instead

**Decision:** Ship no login (access controlled by deployment location), and provide a `DEMO_MODE` that serves static payloads with no upstream calls.

**Why:** The app is single-tenant and read-mostly on a trusted network, so app-level auth adds little (see [`6-security-considerations.md`](6-security-considerations.md)). The demo mode lets the UI be shown publicly / for evaluation without credentials or exposing a real Kodi library.

**Trade-off:** The real instance must not be exposed to the public internet without an external auth layer; the demo instance duplicates deployment surface (its own image tag and NodePort) to keep it credential-free.
