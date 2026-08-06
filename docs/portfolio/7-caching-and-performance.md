# 7 — Caching and Performance

Every endpoint that touches an external API sits behind a file-based TTL cache with a stale-while-revalidate policy. The goal is a dashboard that is **instant on the request path** and stays usable even when TheTVDB, TMDb, or Kodi is slow or offline. Implementation: [`../../backend/src/cache.js`](../../backend/src/cache.js) and `serveWithCache` in [`../../backend/src/server.js`](../../backend/src/server.js).

## Two cache layers

Caching happens at two levels, both persisted to disk:

1. **Per-source cache (`tvdb.json`).** Individual TheTVDB calls are memoised: `favorites:list`, `series:{id}`, `episodes:{id}`. This means enriching many favourites reuses series/episode data across requests and across shows.
2. **Response cache (`responses.json`).** The fully-processed endpoint payloads (`response:favorites`, `response:lastplayed`) are cached whole, so a warm request returns the finished, joined result without touching any upstream source.

Both are instances of the same `FileCache` class writing to `backend/cache/`.

## TTLs

| Constant | Value | Applies to | Rationale |
|---|---|---|---|
| `SERIES_INFO` | 24 h | `series:{id}` | series metadata changes rarely |
| `EPISODES` | 6 h | `episodes:{id}` | schedules change occasionally |
| `FAVORITES` | 30 min | `favorites:list` | the user's favourites list |
| `RESPONSE` | 1 h | `response:*` | full processed endpoint response |

## Stale-while-revalidate

`serveWithCache` classifies each request against the response cache (`REVALIDATE_AFTER = 0.5`):

| State | Condition | Behaviour |
|---|---|---|
| **HIT** | fresh, age < 0.5 TTL | return immediately |
| **STALE** | fresh, age ≥ 0.5 TTL | return immediately **and** start a background refresh |
| **EXPIRED** | past TTL but entry present | return the stale entry (wrapped as `fromCache`) **and** refresh in background |
| **MISS** | nothing cached | compute inline, store, return |
| **error fallback** | inline compute throws | serve any stale entry rather than erroring |

The key property: the **only** request that pays the full upstream cost is a cold MISS. Everything else returns from disk immediately, with freshness restored out of band. `ageFraction(key)` — `(now - cachedAt) / (expiresAt - cachedAt)` — is what drives the 0.5-TTL revalidation trigger.

### De-duplicated background refresh

Background refreshes are tracked in an `inFlightRefresh` map keyed by cache key. If a refresh for a key is already running, additional requests attach to the existing promise instead of launching their own. This prevents a "stampede" where many concurrent STALE/EXPIRED hits would each recompute and hammer the upstream APIs simultaneously.

### Always-fresh derived fields

Some fields are time-relative and would drift even inside a valid cache window — `daysSinceLastAired` and `daysUntilNextAired`. These are recomputed from the stored air dates on **every** cache read via `refreshFavoriteDates` (passed as `refreshDynamic`), so a cached payload never shows a stale day count. The expensive schedule data is cached; the cheap day math is always redone.

## Bounded concurrency

Computing a fresh response fans out one job per series/show. Two anti-patterns are avoided:

- a **serial loop** (correct but slow — dozens of sequential round-trips), and
- an **unbounded `Promise.all`** (fast but liable to trigger upstream rate-limits and overwhelm a Pi-hosted Kodi).

Instead, `runPool(items, limit, fn)` in [`../../backend/src/concurrency.js`](../../backend/src/concurrency.js) keeps at most `limit` jobs in flight, preserving input order. Limits are tuned per source: `TVDB_CONCURRENCY = 8` for TheTVDB/TMDb, `KODI_CONCURRENCY = 6` for Kodi. Within each job, independent sub-calls (e.g. series info + episodes) are issued together with `Promise.all`.

## Non-blocking, coalesced disk writes

Serving one request calls `cache.set()` many times. Writing the whole JSON file synchronously on each `set()` would repeatedly block the event loop. Instead, `FileCache` marks itself dirty and schedules a **single debounced flush** (a 50 ms `setTimeout`); many `set()` calls in a burst collapse into one `writeFileSync`. The timer is `unref`'d, so a pending cache write never keeps the Node process alive during shutdown.

## Offline resilience

The cache is also the offline-survival mechanism:

- The response layer falls back to a stale entry when a fresh compute fails.
- The per-source TheTVDB client falls back to its own stale entries (`getStale`) when the API is unreachable.
- When a stale payload is served, it is wrapped as `{ fromCache, cachedAt, data }`; the frontend detects this and shows the "Showing cached data" banner, while `localStorage` hydration means the UI still renders instantly even before any network call returns.

## Trade-offs

- **Single-replica assumption.** The cache is a local file, not shared. Running multiple backend replicas would give each its own cache (some duplicated upstream work, possibly divergent freshness). The deployment runs a single backend replica ([`../../deploy/k8s/backend.yml`](../../deploy/k8s/backend.yml)), so this is a non-issue in practice; it is the main thing to revisit if the backend is ever scaled out.
- **Ephemeral storage.** The cache lives on the container filesystem, so a pod restart clears it. That is acceptable because the data is fully recomputable and the first post-restart request simply computes fresh.
