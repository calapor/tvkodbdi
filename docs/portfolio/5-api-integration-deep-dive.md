# 5 — API Integration Deep Dive

The backend integrates three external systems, each behind a dedicated client module. This document covers how each is called and how the three are joined per show.

- TheTVDB — [`../../backend/src/thetvdb-client.js`](../../backend/src/thetvdb-client.js)
- TMDb — [`../../backend/src/thetmdb-client.js`](../../backend/src/thetmdb-client.js)
- Kodi — [`../../backend/src/kodi-client.js`](../../backend/src/kodi-client.js)
- Join / orchestration — [`../../backend/src/server.js`](../../backend/src/server.js)

## TheTVDB v4 — auth flow

TheTVDB v4 uses a bearer-token model with an API key:

1. **Lazy authentication.** The client keeps a module-level `token`. On the first authenticated request it POSTs the API key to `https://api4.thetvdb.com/v4/login` and stores `response.data.data.token`. Subsequent requests reuse the token.
2. **Transparent re-auth on 401.** All GETs go through `tvdbGet(url)`, which sends `Authorization: Bearer <token>`. If a request returns **401** (expired token), the client re-authenticates once and retries the same request. This means a token expiring mid-session results in a transparent refresh rather than a failed request that silently serves stale data.
3. **Endpoints used:**
   - `GET /v4/user/favorites` → the user's favourite series ids (`data.series`).
   - `GET /v4/series/{id}` → series metadata (`name`, `slug`, `status`, `image`).
   - `GET /v4/series/{id}/episodes/default` → the episode list (air dates, season/episode, `finaleType`).
4. **Per-call caching + stale fallback.** Each function checks the file cache first (`series:{id}`, `episodes:{id}`, `favorites:list`) and only calls the API on a miss. If the API call fails and a stale cache entry exists, the stale value is returned with a warning rather than propagating the error. Cache TTLs: series info 24 h, episodes 6 h, favourites list 30 min.

`getEpisodeInfo(seriesId, season, episode)` is a convenience that reuses the cached episode list and finds the matching episode locally (no extra API call), which is how `finaleType` is attached to a next-unwatched episode.

## TMDb — runtime lookup pattern

TMDb is used narrowly, as a **runtime fallback only** (`getEpisodeRuntimeFromTMDb`). The client is an `axios` instance with `Authorization: Bearer <TMDB_API_KEY>` against `https://api.themoviedb.org/3`.

Lookup path:

1. **Resolve the TMDb show id.** If the Kodi show already carries a `uniqueid.tmdb`, that id is used directly — the reliable path. Otherwise the client searches `GET /search/tv?query=<title>` and takes the first result (the fuzzy fallback).
2. **Fetch the episode.** `GET /tv/{id}/season/{n}/episode/{m}` returns `runtime` in **minutes**.
3. **Normalise.** If runtime is missing, `NaN`, or `0`, the function returns `0`; otherwise it converts minutes → **seconds** (`runtime * 60`) to match Kodi's unit, so the frontend can treat all runtimes uniformly.
4. **Fail soft.** Any error returns `null` and is logged; a missing TMDb runtime never fails the surrounding show's enrichment.

Crucially, TMDb is only queried when Kodi has no runtime for the next-unwatched episode (`!runtime || runtime === 0`), so most requests skip TMDb entirely.

## Kodi — JSON-RPC structure

Kodi is driven over its JSON-RPC HTTP endpoint (`KODI_HOST`, e.g. `http://192.168.1.10:8080/jsonrpc`) using HTTP basic auth (`KODI_USERNAME` / `KODI_PASSWORD`). Every call is a POST of the shape:

```jsonc
{ "jsonrpc": "2.0", "method": "<Method>", "params": { … }, "id": 1 }
```

Methods used:

| Method | Used by | Purpose |
|---|---|---|
| `VideoLibrary.GetTVShows` | `getTVShows` | list owned shows + `uniqueid` (join keys) |
| `VideoLibrary.GetTVShowDetails` | `getTVShowDetail` | per-show detail incl. `uniqueid.{tvdb,imdb,tmdb}` |
| `VideoLibrary.GetEpisodes` | `getMostRecentEpisode`, `getNextUnWatchedEpisode`, `getLastPlayedTVShows` | episode queries with sort/filter/limits |
| `VideoLibrary.Scan` | `refreshKodiLibrary` | trigger a library rescan |

Kodi query patterns worth noting:

- **Next unwatched episode** — `GetEpisodes` filtered by `playcount is 0`, then sorted client-side by season desc / episode asc to pick the lowest unwatched episode.
- **Recently played** — `GetEpisodes` sorted by `lastplayed` descending with a 500-row limit; the result is de-duplicated to the unique most-recently-played show order.
- **Concurrency** — Kodi calls run through `runPool` with `KODI_CONCURRENCY = 6`, deliberately modest because Kodi typically runs on a Raspberry Pi.

## How the three are joined per show

The join key is the external id **Kodi already stores** on each show (`uniqueid.tvdb`, `uniqueid.tmdb`), which avoids fuzzy title matching on the primary path.

**`/user/favorites` (`computeFavorites`)** — TheTVDB-led:

1. In parallel: TheTVDB favourites list + Kodi show list.
2. Per favourite series (concurrency 8): TheTVDB series info + episodes (parallel) → compute last-aired / next-aired.
3. Match Kodi show by `uniqueid.tvdb == seriesId`; if found, add its most-recent local episode (`mostRecentLocal`).

**`/user/lastplayed` (`computeLastPlayed`)** — Kodi-led:

1. Kodi recently-played → unique shows, each with next-unwatched episode + external ids (Kodi calls, concurrency 6).
2. Per show (concurrency 8), enrich independently and in parallel: TheTVDB artwork by `tvdbid`; TheTVDB `finaleType` for the next-unwatched episode; TMDb runtime **only if** Kodi's runtime is missing/zero.

In both flows, per-show work is wrapped so a single failing show is skipped rather than failing the whole response, and independent sub-calls within a show are issued together with `Promise.all` under the bounded pool.
