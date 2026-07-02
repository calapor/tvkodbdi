# Data Models

The backend aggregates three upstream sources into these response shapes. No data
is persisted in a database — payloads are cached as JSON files on the backend
filesystem (`backend/cache/`).

## Favourite show — `GET /api/user/favorites`
One entry per Kodi favourite series, enriched from TheTVDB (and matched to Kodi):

- `name` — series title (TheTVDB)
- `slug` — series slug (TheTVDB)
- `status` — series status, e.g. "Continuing" / "Ended" (TheTVDB)
- `image` — poster / artwork URL (TheTVDB)
- `lastAiredDate` — air date of the most recent aired episode (or `null`)
- `nextAiredDate` — air date of the next upcoming episode (or `null`)
- `lastEpisode` — `{ season, episode }` of the most recent aired episode (or `null`)
- `nextEpisode` — `{ season, episode }` of the next upcoming episode (or `null`)
- `daysSinceLastAired` — computed at read time from `lastAiredDate`
- `daysUntilNextAired` — computed at read time from `nextAiredDate`
- `mostRecentLocal` — the newest episode present in Kodi, or `null`:
  `{ season, episode, title, firstAired, runtime }`

> `daysSinceLastAired` / `daysUntilNextAired` are recomputed on every cache read
> so day counts stay accurate even when the rest of the payload is served stale.

## Last-played show — `GET /api/user/lastplayed`
Recently-played shows from Kodi, enriched with TheTVDB artwork/finale info and a
TMDb runtime fallback:

- `showtitle` — show title (Kodi)
- `tvdbid` — TheTVDB series id, if known (Kodi `uniqueid`)
- `tmdbid` — TMDb id, if known (Kodi `uniqueid`)
- `image` — poster / artwork URL (TheTVDB, when `tvdbid` is present)
- `nextUnwatched` — the next episode to watch, or `null`:
  `{ season, episode, runtime, finaleType }`
  - `runtime` comes from Kodi; when missing/zero it is filled from TMDb
  - `finaleType` comes from TheTVDB episode metadata

## Kodi refresh — `GET /api/user/kodirefresh`
Fire-and-forget trigger for a Kodi library scan. Returns `{ status: "OK" }`.

## Cache envelope
When a fresh response cannot be produced and a stale one is served instead, the
payload is wrapped:

```json
{ "fromCache": true, "cachedAt": <epoch-ms>, "data": <the payload above> }
```

The frontend unwraps `data` when `fromCache` is set and shows the "cached data"
banner.
