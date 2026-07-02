![tvkodbdi — media tracker & reminders](../docs/tvkodbdi_white.jpg)

# Product Overview

## Summary
tvkodbdi (TheTVDBKodi) is a self-hosted web dashboard that tracks the TV shows in
your Kodi favourites. It aggregates metadata from TheTVDB, TMDb, and your local
Kodi library into a single view of what's airing next, what recently aired, which
shows have ended, and the runtimes of episodes you still have to watch.

## Core capabilities
- Show a unified table of your Kodi favourite series with upcoming and
  recently-aired episode details (season/episode, air date, days since/until air)
- Highlight shows you are behind on downloading and, with a double-click, toggle
  the table between two configurable search URLs to go find them
- List recently-played shows with the runtime of the next unwatched episode,
  falling back to TMDb when Kodi has no runtime
- Trigger a Kodi library scan from the browser (Kodi Refresh button)
- Serve instantly from a file-based cache and refresh in the background, so the
  dashboard stays responsive even when an upstream API is slow or down

## Primary users
Self-hosters who run Kodi at home and want a lightweight "what do I watch next"
dashboard. Technical enough to run Docker / Kubernetes and supply their own API
keys, but expecting a simple, no-login, single-purpose UI.

## External integrations
- **TheTVDB** (v4 API) — series metadata, artwork, episode air dates, finale info
- **TMDb** — episode runtime fallback when Kodi has none
- **Kodi** (JSON-RPC) — the user's favourites, watched state, local episode data,
  and library-scan trigger

## Stack
- Node.js + Express backend (aggregation, caching, three API endpoints)
- React 19 (Create React App) frontend, served by Nginx
- File-based JSON cache — no database
- Docker images, deployed to Kubernetes (k3s), built by Jenkins + Kaniko

## Out of scope
- No user authentication or accounts
- No database or long-term history
- No direct connection to streaming services
- No writing back to Kodi beyond triggering a library scan
- No mobile app (responsive web only)
