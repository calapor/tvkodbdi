const express = require('express');
const dayjs = require('dayjs');
const cors = require('cors');
require('dotenv').config();

const { fetchFavorites, getEpisodesForSeries, getSeriesInfo, getEpisodeInfo } = require('./thetvdb-client');
const { getTVShows, getMostRecentEpisode, getLastPlayedTVShows } = require('./kodi-client');
const { refreshKodiLibrary } = require('./kodi-client');
const { getEpisodeRuntimeFromTMDb } = require('./thetmdb-client');
const { responseCache, TTL } = require('./cache');
const { runPool } = require('./concurrency');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const app = express();
app.use(cors()); // allow React dev server to call your API

const PORT = 3000;

// Max simultaneous in-flight requests to TheTVDB / TMDb. Bounded so we don't
// fan out hundreds of requests at once (and risk rate limiting) while still
// running far faster than the previous one-series-at-a-time loop.
const TVDB_CONCURRENCY = 8;

// Once a cached response is older than this fraction of its TTL, serve it
// immediately but kick off a background refresh (stale-while-revalidate).
const REVALIDATE_AFTER = 0.5;

// ---------------------------------------------------------------------------
// Timing + caching helpers
// ---------------------------------------------------------------------------

/** Elapsed milliseconds (rounded) since an hrtime.bigint() start marker. */
function elapsedMs(start) {
    return Math.round(Number(process.hrtime.bigint() - start) / 1e6);
}

// Tracks in-flight background recomputes so concurrent requests share one
// refresh instead of each triggering their own.
const inFlightRefresh = new Map();

function backgroundRefresh(label, cacheKey, ttl, compute) {
    if (inFlightRefresh.has(cacheKey)) return inFlightRefresh.get(cacheKey);
    const start = process.hrtime.bigint();
    const promise = (async () => {
        try {
            const fresh = await compute();
            responseCache.set(cacheKey, fresh, ttl);
            console.log(`[timing] ${label} refresh=${elapsedMs(start)}ms (background)`);
            return fresh;
        } catch (err) {
            console.warn(`⚠️ Background refresh failed for ${label}: ${err.message}`);
            throw err;
        } finally {
            inFlightRefresh.delete(cacheKey);
        }
    })();
    inFlightRefresh.set(cacheKey, promise);
    return promise;
}

/**
 * Serve an endpoint from the response cache when possible, recomputing only
 * when nothing usable is cached:
 *   - fresh entry            -> return instantly (cache=HIT); if it's aging,
 *                               refresh in the background (cache=STALE)
 *   - expired entry present  -> return it instantly + refresh in background
 *   - nothing cached         -> compute inline (cache=MISS)
 *   - compute throws         -> fall back to any stale entry
 * `refreshDynamic` (optional) recomputes time-relative fields (e.g. days
 * since aired) on the way out so cached payloads stay accurate.
 */
async function serveWithCache(res, label, cacheKey, ttl, compute, { refreshDynamic } = {}) {
    const start = process.hrtime.bigint();
    const apply = (data) => (refreshDynamic ? refreshDynamic(data) : data);

    const fresh = responseCache.get(cacheKey);
    if (fresh) {
        const age = responseCache.ageFraction(cacheKey);
        let cacheState = 'HIT';
        if (age !== null && age >= REVALIDATE_AFTER) {
            cacheState = 'STALE';
            backgroundRefresh(label, cacheKey, ttl, compute).catch(() => {});
        }
        console.log(`[timing] ${label} total=${elapsedMs(start)}ms cache=${cacheState}`);
        return res.json(apply(fresh));
    }

    // No fresh entry — serve an expired one immediately if we have it.
    const stale = responseCache.getStale(cacheKey);
    if (stale) {
        const meta = responseCache.getMeta(cacheKey);
        backgroundRefresh(label, cacheKey, ttl, compute).catch(() => {});
        console.log(`[timing] ${label} total=${elapsedMs(start)}ms cache=EXPIRED`);
        return res.json({ fromCache: true, cachedAt: meta.cachedAt, data: apply(stale) });
    }

    // Cold cache — must compute inline.
    try {
        const data = await compute();
        responseCache.set(cacheKey, data, ttl);
        console.log(`[timing] ${label} total=${elapsedMs(start)}ms cache=MISS`);
        return res.json(apply(data));
    } catch (err) {
        console.error(`❌ Top-level error in ${label}: ${err.message}`);
        const fallback = responseCache.getStale(cacheKey);
        if (fallback) {
            const meta = responseCache.getMeta(cacheKey);
            console.warn(`⚠️ Serving cached ${label} from`, new Date(meta.cachedAt).toISOString());
            return res.json({ fromCache: true, cachedAt: meta.cachedAt, data: apply(fallback) });
        }
        return res.status(500).json({ error: `Failed to fetch ${label}` });
    }
}

// ---------------------------------------------------------------------------
// /user/favorites
// ---------------------------------------------------------------------------

// Recompute time-relative day counts from the stored air dates so they stay
// accurate even when the rest of the payload is served from cache.
function refreshFavoriteDates(shows) {
    return shows.map(show => ({
        ...show,
        daysSinceLastAired: show.lastAiredDate ? dayjs().diff(dayjs(show.lastAiredDate), 'day') : null,
        daysUntilNextAired: show.nextAiredDate ? dayjs(show.nextAiredDate).diff(dayjs(), 'day') : null,
    }));
}

async function computeFavorites() {
    const [thetvdbFavorites, kodiShows] = await Promise.all([
        fetchFavorites(),
        getTVShows(),
    ]);

    const results = await runPool(thetvdbFavorites, TVDB_CONCURRENCY, async (seriesId) => {
        try {
            // These two TVDB calls are independent — run them together.
            const [seriesInfo, episodes] = await Promise.all([
                getSeriesInfo(seriesId),
                getEpisodesForSeries(seriesId),
            ]);

            const today = new Date();
            const MIN_VALID_DATE = new Date('1980-01-01');
            const datedEpisodes = episodes.filter(ep => {
                if (!ep.aired || ep.seasonNumber === 0) return false;
                const d = new Date(ep.aired);
                return !isNaN(d) && d > MIN_VALID_DATE;
            });
            const pastEpisodes = datedEpisodes.filter(ep => new Date(ep.aired) <= today);
            const futureEpisodes = datedEpisodes.filter(ep => new Date(ep.aired) >= today);

            let lastEpisode = null;
            if (pastEpisodes.length > 0) {
                const latestAirDate = pastEpisodes.reduce((latest, ep) => {
                    const date = new Date(ep.airDate || ep.aired);
                    return date > latest ? date : latest;
                }, new Date(0));

                const episodesOnLatestDate = pastEpisodes.filter(ep =>
                    new Date(ep.airDate || ep.aired).getTime() === latestAirDate.getTime()
                );

                lastEpisode = episodesOnLatestDate.reduce((maxEp, ep) =>
                    ep.number > maxEp.number ? ep : maxEp
                );
            }
            const nextEpisode = futureEpisodes.sort((a, b) => new Date(a.aired) - new Date(b.aired))[0];

            const kodiMatch = kodiShows.find(s => s.uniqueid?.tvdb == seriesId);
            let mostRecentLocal = null;
            if (kodiMatch) {
                mostRecentLocal = await getMostRecentEpisode(kodiMatch.tvshowid);
            }

            return {
                name: seriesInfo.name,
                slug: seriesInfo.slug,
                status: seriesInfo.status.name,
                image: seriesInfo.image,
                lastAiredDate: lastEpisode?.aired || null,
                nextAiredDate: nextEpisode?.aired || null,
                lastEpisode: lastEpisode
                    ? { season: lastEpisode.seasonNumber, episode: lastEpisode.number }
                    : null,
                nextEpisode: nextEpisode
                    ? { season: nextEpisode.seasonNumber, episode: nextEpisode.number }
                    : null,
                daysSinceLastAired: lastEpisode ? dayjs().diff(dayjs(lastEpisode.aired), 'day') : null,
                daysUntilNextAired: nextEpisode ? dayjs(nextEpisode.aired).diff(dayjs(), 'day') : null,
                mostRecentLocal: mostRecentLocal
                    ? {
                        season: mostRecentLocal.season,
                        episode: mostRecentLocal.episode,
                        title: mostRecentLocal.title,
                        firstAired: mostRecentLocal.firstaired,
                        runtime: mostRecentLocal.runtime,
                    }
                    : null,
            };
        } catch (error) {
            const status = error.response?.status;
            console.warn(`⚠️ Skipping series ID ${seriesId}. Status: ${status}. Message: ${error.message}`);
            return null; // skip this series
        }
    });

    return results.filter(Boolean);
}

app.get('/user/favorites', (req, res) => {
    if (DEMO_MODE) return res.json(require('./demo/favorites.json'));
    return serveWithCache(res, '/user/favorites', 'response:favorites', TTL.RESPONSE, computeFavorites, {
        refreshDynamic: refreshFavoriteDates,
    });
});

// ---------------------------------------------------------------------------
// /user/lastplayed
// ---------------------------------------------------------------------------

async function computeLastPlayed() {
    const lastPlayedShows = await getLastPlayedTVShows(); // list from Kodi — needs enriching

    // Enrich each show with TVDB artwork / finale info and a TMDb runtime
    // fallback. Per-show enrichments are independent, so run them concurrently
    // (and bounded) instead of one show after another.
    await runPool(lastPlayedShows, TVDB_CONCURRENCY, async (show) => {
        const hasTvdbId = show.tvdbid !== null && show.tvdbid !== undefined;
        const tasks = [];

        if (hasTvdbId) {
            tasks.push((async () => {
                const enrichedTVshow = await getSeriesInfo(show.tvdbid);
                if (enrichedTVshow) show.image = enrichedTVshow.image;
            })());
        }

        if (hasTvdbId && show.nextUnwatched) {
            tasks.push((async () => {
                const enrichedEpisode = await getEpisodeInfo(
                    show.tvdbid, show.nextUnwatched.season, show.nextUnwatched.episode
                );
                if (enrichedEpisode) show.nextUnwatched.finaleType = enrichedEpisode.finaleType;
            })());
        } else if (!show.nextUnwatched) {
            console.log('NO NEXT UNWATCHED EPISODE FOR :', show.showtitle);
        }

        if (show.nextUnwatched && (!show.nextUnwatched.runtime || show.nextUnwatched.runtime === 0)) {
            tasks.push((async () => {
                try {
                    const runtime = await getEpisodeRuntimeFromTMDb(
                        show.showtitle, show.nextUnwatched.season, show.nextUnwatched.episode, show.tmdbid
                    );
                    if (runtime) show.nextUnwatched.runtime = runtime;
                } catch (error) {
                    console.warn(`⚠️ Skipping show enrichment. Message: ${error.message}`);
                }
            })());
        }

        await Promise.all(tasks);
        return show;
    });

    return lastPlayedShows;
}

app.get('/user/lastplayed', (req, res) => {
    if (DEMO_MODE) return res.json(require('./demo/lastplayed.json'));
    return serveWithCache(res, '/user/lastplayed', 'response:lastplayed', TTL.RESPONSE, computeLastPlayed);
});

// ---------------------------------------------------------------------------
// /user/kodirefresh
// ---------------------------------------------------------------------------

app.get('/user/kodirefresh', async (req, res) => {
    if (DEMO_MODE) return res.status(200).json({ status: 'OK' });
    try {
        console.log('WE GOT A BACKEND CALL');
        refreshKodiLibrary();
    } catch (err) {
        console.error('❌ Top-level error in /user/kodirefresh:', err.message);
        return res.status(500).json({ error: 'Failed to refresh Kodi library' });
    }
    res.status(200).json({ status: 'OK' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}...`);
});
