const express = require('express');
const dayjs = require('dayjs');
const cors = require('cors');
require('dotenv').config();
const router = express.Router();


const { fetchFavorites, getEpisodesForSeries, getSeriesInfo,getSeriesStatus,getEpisodeInfo } = require('./thetvdb-client');
const { getTVShows, getMostRecentEpisode, getEpisodeFromKodi,getLastPlayedTVShows,getTVShowDetail,getRecentShowsWithUnwatchedEpisodes,getInProgressTVShows,
    getNextUnWatchedEpisode,refreshKodiLibrary} = require('./kodi-client');
const { getEpisodeRuntimeFromTMDb} = require('./thetmdb-client');
const { responseCache, TTL } = require('./cache');


const app = express();
app.use(cors()); // allow React dev server to call your API

const PORT = 3000;
console.log(process.env);
console.log("=======");
console.log(process.env.TVDB_API_KEY);
console.log(process.env.TMDB_API_KEY);
console.log(process.env.KODI_USERNAME);
console.log(process.env.KODI_PASSWORD);
console.log(process.env.KODI_HOST);


function daysFromNow(dateStr) {
    if (!dateStr) return null;
    const date = dayjs(dateStr);
    return date.isValid() ? date.diff(dayjs(), 'day') : null;
}

router.get('/user/favorites', async (req, res) => {
    const CACHE_KEY = 'response:favorites';
    try {
        const [thetvdbFavorites, kodiShows] = await Promise.all([
            fetchFavorites(),
            getTVShows()
        ]);

        const results = [];

        for (const seriesId of thetvdbFavorites) {
            try {
                const seriesInfo = await getSeriesInfo(seriesId);
                const episodes = await getEpisodesForSeries(seriesId);
                const today = new Date();
                const pastEpisodes = episodes.filter(ep => new Date(ep.aired) <= today).filter(ep => ep.seasonNumber !== 0);;
                const futureEpisodes = episodes.filter(ep => new Date(ep.aired) >= today).filter(ep => ep.seasonNumber !== 0);;
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
                results.push({
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
                        : null
                });

            } catch (error) {
                const status = error.response?.status;
                console.warn(`⚠️ Skipping series ID ${seriesId}. Status: ${status}. Message: ${error.message}`);
                continue; // skip this series
            }
        }

        responseCache.set(CACHE_KEY, results, TTL.RESPONSE);
        res.json(results);

    } catch (err) {
        console.error('❌ Top-level error in /user/favorites:', err.message);

        const cached = responseCache.getStale(CACHE_KEY);
        if (cached) {
            const meta = responseCache.getMeta(CACHE_KEY);
            console.warn('⚠️ Serving cached favorites response from', new Date(meta.cachedAt).toISOString());
            // Recalculate dynamic date fields from stored air dates so they remain accurate
            const refreshed = cached.map(show => ({
                ...show,
                daysSinceLastAired: show.lastAiredDate ? dayjs().diff(dayjs(show.lastAiredDate), 'day') : null,
                daysUntilNextAired: show.nextAiredDate ? dayjs(show.nextAiredDate).diff(dayjs(), 'day') : null,
            }));
            return res.json({ fromCache: true, cachedAt: meta.cachedAt, data: refreshed });
        }

        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});




router.get('/user/lastplayed', async (req, res) => {
    const CACHE_KEY = 'response:lastplayed';
    try {
        const [lastPlayedShows] = await Promise.all([
            getLastPlayedTVShows(), // just gets a list from kodi - it needs to be enriched
        ]);
        const results = [];
        for (const showId of lastPlayedShows) {
            if (showId.tvdbid !== null && showId.tvdbid !== undefined) {
                const enrichedTVshow = await getSeriesInfo(showId.tvdbid);
                if (enrichedTVshow) {
                    showId.image = enrichedTVshow.image;
                }
            }
            const tvshowDetails = lastPlayedShows.find(s => s.tvdbid === showId.tvdbid);
            if (showId.nextUnwatched === null || showId.nextUnwatched === undefined) {
                console.log("NO NEXT UNWATCHED EPISODE FOR :", showId.showtitle);
                continue;
            } else {
                if (showId.nextUnwatched !== null && showId.nextUnwatched !== undefined && showId.tvdbid !== null && showId.tvdbid !== undefined) {
                    if (showId.tvdbid !== null || showId.tvdbid !== undefined){
                    const enrichedEpisode = await getEpisodeInfo(showId.tvdbid, showId.nextUnwatched.season, showId.nextUnwatched.episode);
                    if (enrichedEpisode) {
                        showId.nextUnwatched.finaleType = enrichedEpisode.finaleType;
                    }
                    }
                }
            }
            // Enrich each show with detailed info from TheTVDB
            try {
                if (
                    showId &&
                    showId.nextUnwatched &&
                    (!showId.nextUnwatched.runtime || showId.nextUnwatched.runtime === 0)
                ){
                    results.push(showId);
                    const runtime = await getEpisodeRuntimeFromTMDb(showId.showtitle, showId.nextUnwatched.season, showId.nextUnwatched.episode,showId.tmdbid);
                    if (runtime) {
                        showId.nextUnwatched.runtime = runtime;
                    }
                    if (runtime) {
                        showId.nextUnwatched.runtime = runtime;
                    }
                }
                else {
                    results.push(showId);
                }
            } catch (error) {
                console.warn(`⚠️ Skipping show enrichment. Message: ${error.message}`);
            }
        }

        responseCache.set(CACHE_KEY, results, TTL.RESPONSE);
        res.json(results);
    } catch (err) {
        console.error('❌ Top-level error in /user/lastplayed:', err.message);

        const cached = responseCache.getStale(CACHE_KEY);
        if (cached) {
            const meta = responseCache.getMeta(CACHE_KEY);
            console.warn('⚠️ Serving cached lastplayed response from', new Date(meta.cachedAt).toISOString());
            return res.json({ fromCache: true, cachedAt: meta.cachedAt, data: cached });
        }

        res.status(500).json({ error: 'Failed to fetch lastplayed' });
    }
});



router.get('/user/kodirefresh', async (req, res) => {
    try {
        console.log('WE GOT A BACKEND CALL');
        refreshKodiLibrary();

    } catch (err) {
        console.error('❌ Top-level error in /user/kodirefresh:', err.message);
        res.status(500).json({ error: 'Failed to fetch lastplayed' });
    }
    res.status(200).json({ status: 'OK' });
});

app.use('/api', router);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}...`);
});



