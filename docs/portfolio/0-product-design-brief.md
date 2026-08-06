# 0 — Product Design Brief

## The problem

Kodi is an excellent media centre for playing what you already have, but it is poor at answering the two questions a serial TV watcher actually asks:

1. **"What should I watch next?"** — across all my shows, which have an unwatched episode waiting, and how long is it?
2. **"What's coming, and what have I missed?"** — for the shows I follow, when did the last episode air, when does the next one air, and am I behind on getting hold of it?

Kodi surfaces per-show watched state, but it does not aggregate across a favourites list, it does not know about episodes that have aired but are not yet in your library, and its metadata for air dates and finale markers is patchy. The information needed to answer those questions is spread across three systems:

- **Kodi** knows what you own and what you have watched.
- **TheTVDB** knows the authoritative episode schedule (air dates, season/episode numbering, series status, finale markers, artwork).
- **TMDb** knows episode runtimes that Kodi sometimes lacks.

No single one of these has the full picture. tvkodbdi exists to join them.

## What the app does

tvkodbdi is a self-hosted web dashboard with three tabs (see [`../../frontend/src/components/tvkodbdi.js`](../../frontend/src/components/tvkodbdi.js)):

- **Upcoming Shows** — your Kodi favourite series, each enriched from TheTVDB with the last-aired and next-aired episode, the season/episode numbers, and a human-readable "days since / until air".
- **Ended Shows** — favourites whose TheTVDB status is ended, separated out so the active list stays focused.
- **Active Show Runtimes** — recently-played shows from Kodi with their next unwatched episode and its runtime, so you can pick something that fits the time you have. When Kodi has no runtime for that episode, it is filled from TMDb.

Supporting behaviours:

- A **behind-on-downloads** indicator (⚠️) with a double-click gesture that toggles the tables between two configurable search URLs, so you can jump straight to finding the missing episode.
- A **Kodi Refresh** button that triggers a `VideoLibrary.Scan` so newly-added media is picked up.
- **Cache-first serving** so the dashboard is instant and stays usable when an upstream source is slow or offline, with a banner indicating cached data.

## What the app does not do

These are deliberate scope boundaries (mirrored in [`../../specs/product-overview.md`](../../specs/product-overview.md)):

- **No user accounts or authentication.** Access is controlled by where it is deployed (home LAN / cluster).
- **No database or long-term history.** State is a file-based cache plus the browser's `localStorage`.
- **No connection to streaming services.** It reports on your local Kodi library and public metadata only.
- **No writing back to Kodi** beyond triggering a library scan. It never modifies your media or watched state.
- **No AI/ML.** All logic is deterministic date and set math.
- **No native mobile app.** It is a responsive web UI only.

## Intended user

A self-hoster who already runs Kodi at home, is comfortable running Docker / Kubernetes, and can supply their own TheTVDB and TMDb API keys — but who wants a simple, no-login, single-purpose "what do I watch next" dashboard rather than another heavyweight media manager.
