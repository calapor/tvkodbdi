# 1 — Pre-Development Phase

Before writing the aggregation backend, the central question was: **where does each piece of the "what do I watch next" answer actually live, and can any single source provide it?** The conclusion was that no single source is sufficient, which is why the backend integrates three.

## Why three separate data sources

Each source is authoritative for a different slice of the problem, and none covers the others well.

### Kodi — what you own and what you have watched

Kodi is the only source that knows the user's actual library and playback state. Through its JSON-RPC API it exposes:

- The favourite/owned series and their external ids (`uniqueid.tvdb`, `uniqueid.imdb`, `uniqueid.tmdb`).
- Watched state per episode (`playcount`, `lastplayed`, `resume`), which drives the "next unwatched episode" calculation.
- Local episode data (season/episode, `firstaired`, `runtime`, file path).

What Kodi is weak at: it only knows about episodes that are already scanned into the library, so it cannot tell you about an episode that has aired upstream but that you have not downloaded yet. Its air-date and finale metadata is also inconsistent. That gap is exactly what drove pulling in an external schedule source.

### TheTVDB — the authoritative episode schedule

TheTVDB (v4 API) provides the canonical episode list and series metadata that Kodi cannot: full episode air dates (including future episodes), consistent season/episode numbering, series status (Continuing / Ended), poster artwork, and finale markers (`finaleType`). This is what powers the "last aired / next aired / days until air" columns and the ended-shows split.

It was chosen as the schedule source because it is the same catalogue Kodi's TVDB scraper already uses, so the `uniqueid.tvdb` on each Kodi show is a direct, reliable join key — no fuzzy title matching required for the primary path.

### TMDb — the runtime fallback

TMDb is used narrowly: **only** to supply an episode runtime when Kodi does not have one (see [`../../backend/src/thetmdb-client.js`](../../backend/src/thetmdb-client.js)). Runtime matters for the "what fits the time I have" use case, and Kodi's runtime field is frequently `0` or missing for episodes that were added without full metadata. TMDb exposes per-episode runtime via `/tv/{id}/season/{n}/episode/{m}`. When the Kodi show carries a `uniqueid.tmdb`, that id is used directly; otherwise the client falls back to a title search (`/search/tv`) and takes the first result.

## Why not a single source

Several single-source designs were considered and rejected on the basis of the source evaluation above:

- **Kodi only** — cannot answer "what has aired that I don't have yet", has unreliable air dates and no finale markers, and often lacks runtimes. It knows your library but not the world.
- **TheTVDB only** — has the schedule and artwork but no knowledge of what you own or have watched, so it cannot compute "next unwatched" or "behind on downloads".
- **TMDb only** — good general metadata but, again, no library/watched state, and its data was only needed for the runtime gap, not as a primary schedule.

Each source is best-in-class for its slice and deficient elsewhere. Joining them per show — Kodi for ownership/watched state and ids, TheTVDB for schedule/artwork/status, TMDb for the runtime fallback — is what makes the dashboard useful. The join key is the external id Kodi already stores (`uniqueid.tvdb` / `uniqueid.tmdb`), which keeps the merge cheap and unambiguous.

## Other early decisions

- **No database.** The data is derived and disposable — it can always be recomputed from the three upstream sources. That made a file-based TTL cache a better fit than a database (see [`7-caching-and-performance.md`](7-caching-and-performance.md)).
- **Backend-mediated, never browser-direct.** All three integrations require credentials (or, for Kodi, live on the private LAN), so the browser must never talk to them directly. This forced the Nginx-proxy-to-Express topology from day one (see [`2-system-architecture.md`](2-system-architecture.md)).
- **Target hardware: arm64 home cluster.** The intended deployment is a Raspberry Pi / k3s cluster, which shaped the Docker build strategy (build React on the native platform, run on arm64) early.
