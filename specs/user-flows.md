# User Flows

## Landing → Dashboard
1. User opens the app at `/` and sees the landing page.
2. User navigates to the dashboard at `/tvkodbdi`.
3. The dashboard immediately renders any previously seen data from `localStorage`
   (favourites and runtimes), so there is no blank loading screen on return visits.
4. In the background the app fetches `/api/user/favorites` and `/api/user/lastplayed`,
   then updates the tables and re-caches the fresh payloads to `localStorage`.
5. Data is refreshed whenever the tab becomes visible again and on an hourly poll.

## The three tabs
- **Upcoming Shows** — favourite series with their last-aired and next-aired
  episodes, days since / until air, and (optionally) the last downloaded episode.
- **Ended Shows** — favourites whose status is ended.
- **Active Show Runtimes** — recently-played shows with the next unwatched episode
  and its runtime (from Kodi, or TMDb as a fallback).

## Finding shows you're behind on
1. A ⚠️ indicator marks shows that are behind on downloads.
2. Clicking a show opens a search using the currently-active search URL.
3. **Double-clicking anywhere in the table toggles** between the two configured
   search URLs (`searchlink1` ⇄ `searchlink2`) and between the two site URLs
   (`urllink1` ⇄ `urllink2`), letting the user switch search backends on the fly.
4. The two search URLs are set at build time via `REACT_APP_SEARCH_LINK_1` /
   `REACT_APP_SEARCH_LINK_2`, so they can be changed without touching the code.

## Kodi Refresh
1. User clicks the Kodi icon (bottom-left).
2. The app calls `/api/user/kodirefresh`, which asks Kodi (via JSON-RPC) to scan
   its library for new media.
3. An alert confirms the request was accepted.

## Resilience the user sees
- **Cache banner** — when data is served from cache because a live source was
  unavailable, a "Showing cached data" banner appears.
- **Error banner** — when the backend or an upstream service is unreachable and
  nothing usable is cached, an error banner explains the connection failed.
- **Build badge** — the running build version is shown discreetly in the
  bottom-right corner.

## What the app does and does not do
- It reads from Kodi and enriches with TheTVDB/TMDb; it never modifies your media.
- The only write action is triggering a Kodi library scan.
- There is no login — access is controlled by where you deploy it (LAN / cluster).
