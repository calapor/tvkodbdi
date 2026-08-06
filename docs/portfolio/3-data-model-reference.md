# 3 — Data Model Reference

The backend aggregates three upstream sources into a small number of response shapes. **No data is persisted in a database** — payloads are cached as JSON files on the backend filesystem (`backend/cache/`). This document describes what each source contributes, how records are merged, and the on-disk cache format.

Source specs: [`../../specs/data-models.md`](../../specs/data-models.md). Implementation: [`../../backend/src/server.js`](../../backend/src/server.js), [`../../backend/src/kodi-client.js`](../../backend/src/kodi-client.js), [`../../backend/src/thetvdb-client.js`](../../backend/src/thetvdb-client.js).

> The backend is plain JavaScript (CommonJS), so these "types" are the object shapes produced by the aggregation code, not declared TypeScript interfaces.

## What each source provides

| Field(s) | Source | Notes |
|---|---|---|
| favourite series ids | TheTVDB (`/user/favorites`) | list of series ids the user favourited on TheTVDB |
| `name`, `slug`, `status`, `image` | TheTVDB (`/series/{id}`) | series metadata + artwork; `status.name` is e.g. "Continuing" / "Ended" |
| episode list, air dates, `finaleType` | TheTVDB (`/series/{id}/episodes/default`) | authoritative schedule incl. future episodes |
| owned shows + `uniqueid.{tvdb,imdb,tmdb}` | Kodi (`VideoLibrary.GetTVShows` / `GetTVShowDetails`) | the join keys to external sources |
| watched state (`playcount`, `lastplayed`, `resume`) | Kodi (`VideoLibrary.GetEpisodes`) | drives "next unwatched" |
| local `runtime`, `firstaired`, season/episode | Kodi | per-episode local data |
| runtime fallback | TMDb (`/tv/{id}/season/{n}/episode/{m}`) | only used when Kodi runtime is missing/zero |

## `GET /api/user/favorites`

One entry per favourite series, built in `computeFavorites`. TheTVDB provides the schedule and metadata; Kodi is matched by `uniqueid.tvdb` to add the newest locally-present episode.

```jsonc
{
  "name": "string",                 // TheTVDB series title
  "slug": "string",                 // TheTVDB slug
  "status": "string",               // TheTVDB status.name, e.g. "Continuing"
  "image": "https://…",             // TheTVDB poster/artwork URL
  "lastAiredDate": "YYYY-MM-DD|null",
  "nextAiredDate": "YYYY-MM-DD|null",
  "lastEpisode": { "season": 3, "episode": 7 },   // or null
  "nextEpisode": { "season": 3, "episode": 8 },   // or null
  "daysSinceLastAired": 12,         // recomputed at read time from lastAiredDate
  "daysUntilNextAired": 2,          // recomputed at read time from nextAiredDate
  "mostRecentLocal": {              // newest episode present in Kodi, or null
    "season": 3, "episode": 7,
    "title": "string",
    "firstAired": "YYYY-MM-DD",
    "runtime": 3600
  }
}
```

Merge logic (`computeFavorites`):

1. Fetch the TheTVDB favourites list and Kodi's show list in parallel.
2. For each favourite series (via `runPool`, concurrency 8): fetch series info and episodes together.
3. Filter to dated, non-special episodes (`seasonNumber !== 0`, air date after 1980-01-01), split into past/future, and pick the latest-aired and next-upcoming.
4. Find the Kodi show whose `uniqueid.tvdb` equals the series id; if matched, fetch its most-recent local episode.
5. `daysSinceLastAired` / `daysUntilNextAired` are computed with `dayjs`, and **recomputed on every cache read** by `refreshFavoriteDates` so day counts never go stale.

## `GET /api/user/lastplayed`

Recently-played shows from Kodi, enriched with TheTVDB artwork/finale info and a TMDb runtime fallback. Built in `computeLastPlayed` over `getLastPlayedTVShows`.

```jsonc
{
  "tvshowid": 42,                   // Kodi internal id
  "showtitle": "string",            // Kodi
  "lastplayed": "YYYY-MM-DD HH:mm:ss",
  "playcount": 4,
  "image": "https://…",             // TheTVDB (when tvdbid known)
  "tvdbid": "70369|null",
  "imdbid": "tt…|null",
  "tmdbid": "1234|null",
  "nextUnwatched": {                // next episode to watch, or null
    "season": 2, "episode": 5,
    "title": "string",
    "episodeid": 987,
    "runtime": 2700,                // Kodi; filled from TMDb when missing/zero
    "finaleType": "season|series|none"  // from TheTVDB episode metadata
  }
}
```

Merge logic:

1. `getLastPlayedTVShows` calls Kodi `VideoLibrary.GetEpisodes` sorted by `lastplayed` desc, then de-duplicates to the unique most-recently-played show order.
2. Per show (via `runPool`, Kodi concurrency 6): fetch the next unwatched episode (`playcount = 0`, sorted to the lowest unwatched season/episode) and the show detail (for external ids), in parallel.
3. Then, per show (via `runPool`, TVDB concurrency 8): add TheTVDB artwork (`image`) when a `tvdbid` exists, add `finaleType` from TheTVDB episode metadata for the next-unwatched episode, and — only if the Kodi runtime is missing or `0` — fill `runtime` from TMDb (using `tmdbid` if present, else a title search). Runtime from TMDb is converted from minutes to seconds to match Kodi's unit.

## `GET /api/user/kodirefresh`

Fire-and-forget trigger for a Kodi `VideoLibrary.Scan`. Returns `{ "status": "OK" }` immediately without waiting for the scan.

## Cache envelope

When a fresh response cannot be produced and a stale one is served instead, the payload is wrapped:

```jsonc
{ "fromCache": true, "cachedAt": 1712345678901, "data": <the payload above> }
```

The frontend unwraps `data` when `fromCache` is set and shows the "Showing cached data" banner.

## On-disk cache file format

The file cache (`FileCache` in [`../../backend/src/cache.js`](../../backend/src/cache.js)) writes two files under `backend/cache/`:

- `tvdb.json` — per-source TheTVDB entries: `favorites:list`, `series:{id}`, `episodes:{id}`.
- `responses.json` — fully-processed endpoint payloads: `response:favorites`, `response:lastplayed`.

Each entry is stored as:

```jsonc
{
  "<cacheKey>": {
    "value": <cached payload>,
    "cachedAt": <epoch-ms>,
    "expiresAt": <epoch-ms>
  }
}
```

`get()` returns `value` only if `Date.now() <= expiresAt`; `getStale()` ignores expiry (offline fallback); `ageFraction()` returns `(now - cachedAt) / (expiresAt - cachedAt)` and drives the stale-while-revalidate decision.

## TTL constants

Defined in [`../../backend/src/cache.js`](../../backend/src/cache.js):

| Constant | Value | Applies to |
|---|---|---|
| `SERIES_INFO` | 24 hours | `series:{id}` — series metadata changes rarely |
| `EPISODES` | 6 hours | `episodes:{id}` — schedules change occasionally |
| `FAVORITES` | 30 minutes | `favorites:list` — the user's favourites list |
| `RESPONSE` | 1 hour | `response:*` — full processed endpoint responses |
