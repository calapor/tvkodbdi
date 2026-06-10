// kodi-client.js
const axios = require('axios');
const dotenv = require('dotenv');
const { runPool } = require('./concurrency');

dotenv.config();

// Max simultaneous in-flight requests to Kodi (runs on a Pi, so keep modest).
const KODI_CONCURRENCY = 6;

const kodi_host =  process.env.KODI_HOST;
const kodi_username = process.env.KODI_USERNAME;
const kodi_password = process.env.KODI_PASSWORD;
const kodi = axios.create({
    baseURL: kodi_host,
    auth: {
        username: kodi_username,
        password: kodi_password
    },
    headers: {
        'Content-Type': 'application/json'
    }
});


async function getTVShows() {
    const payload = {
        jsonrpc: "2.0",
        method: "VideoLibrary.GetTVShows",
        params: {
            properties: ["title", "uniqueid" ]
        },
        id: 1
    };
    const response = await kodi.post('', payload);
    return response.data.result.tvshows || [];
}

async function getEpisodeDetailFromKodi(episodeId) {
    const payload = {
        jsonrpc: '2.0',
        method: 'VideoLibrary.GetEpisodeDetails',
        params: {
            episodeId: episodeId,
            "properties": ["title", "season", "episode","runtime"]        },
        id: 1
    };
    const response = await kodi.post('', payload);
    return response.data.result.episodedetails || null;
}


async function getEpisodeFromKodi(tvshowid, season, episode) {
    const payload = {
        jsonrpc: '2.0',
        method: 'VideoLibrary.GetEpisodes',
        params: {
            tvshowid,
            season,
            properties: ['title', 'runtime', 'episode', 'season', 'firstaired'],
        },
        id: 1
    };
    const response = await kodi.post('', payload);
    const episodes = response.data.result.episodes || [];
    return episodes.find(e => e.episode === episode);
}





/*
===========================
===========================
===========================
 */
async function getTVShowDetail(tvshowid) {
    const payload = {
        jsonrpc: "2.0",
        method: "VideoLibrary.GetTVShowDetails",
        params: {
            tvshowid: tvshowid,
            properties: ["title", "genre", "year", "rating", "plot", "runtime", "uniqueid"]
        },
        id: 1
    };

    try {
        const response = await kodi.post('', payload);
        const result = response.data.result;
        if (result && result.tvshowdetails) {
            return result.tvshowdetails;
        } else {
            console.warn(`⚠️ No tvshowdetails returned for tvshowid: ${tvshowid}`);
            return null;
        }
    } catch (err) {
        console.error(`❌ Error in getTVShowDetail(tvshowid: ${tvshowid}): ${err.message}`);
        return null;
    }
}




async function getMostRecentEpisode(tvshowid) {
    const payload = {
        jsonrpc: "2.0",
        method: "VideoLibrary.GetEpisodes",
        params: {
            tvshowid,
            properties: ["season", "episode", "title", "firstaired", "file","runtime"],
            sort: {
                method: "episode",
                order: "descending"
                //},filter: {
                //    "field": "playcount",
                //    "operator": "is",
                //    "value": "0"
                },
                /* TODO: THIS IS A BUG I HAVE INTRODUCED BACK?*/
            limits: { start: 0, end: 100 }
        },
        id: 1
    };
    const response = await kodi.post('', payload);
    const episodes = response.data.result.episodes || [];
    return episodes[0] || null;
}


async function getNextUnWatchedEpisode(tvshowid) {
        const payload = {
            jsonrpc: "2.0",
            method: "VideoLibrary.GetEpisodes",
            params: {
                tvshowid,
                properties: ["season", "episode", "title", "firstaired", "file", "runtime", "playcount"],
                sort: {
                    method: "season",
                    order: "descending"
                },
                filter: {
                    field: "playcount",
                    operator: "is",
                    value: "0"
                },
                limits: { start: 0, end: 1000 } // Increase if needed
            },
            id: 1
        };

        try {
            const response = await kodi.post('', payload);
            const episodes = response.data?.result?.episodes || [];

            // Sort by season DESC, then episode DESC
            episodes.sort((a, b) => {
                if (b.season !== a.season) return b.season - a.season;
                return a.episode - b.episode;
            });

            return episodes[0] || null; // Most recent unwatched
        } catch (error) {
            console.error("❌ Error fetching most recent episode:", error.message);
            return null;
        }
    }

/*
This is the main function to get last played TV shows with next unwatched episode  for the active runtimes table on the frontend
 */
async function getLastPlayedTVShows() {
    const payload = {
        jsonrpc: "2.0",
        method: "VideoLibrary.GetEpisodes",
        params: {
            properties: ["title", "tvshowid", "showtitle", "season", "episode", "playcount", "lastplayed", "resume"],
            sort: {
                order: "descending",
                method: "lastplayed"
            },
            limits: { start: 0, end: 500 }
        },
        id: 1
    };
    const response = await kodi.post('', payload);

    const episodes = response.data?.result?.episodes || [];

    // Kodi returns episodes already sorted by lastplayed (descending), so the
    // first time we see a tvshowid is that show's most-recently-played entry.
    // Collect the unique shows in that order.
    const uniqueShows = [];
    const seenShowIds = new Set();
    for (const ep of episodes) {
        if (seenShowIds.has(ep.tvshowid)) continue;
        seenShowIds.add(ep.tvshowid);
        uniqueShows.push(ep);
    }

    // Enrich each show with its next-unwatched episode and TVDB/IMDB/TMDB ids.
    // The two Kodi calls per show are independent, so run them together, and
    // process shows with bounded concurrency instead of one-at-a-time.
    const finalList = await runPool(uniqueShows, KODI_CONCURRENCY, async (ep) => {
        const [nextEp, detailed] = await Promise.all([
            getNextUnWatchedEpisode(ep.tvshowid),
            getTVShowDetail(ep.tvshowid),
        ]);

        let nextUnwatched = null;
        if (nextEp) {
            nextUnwatched = {
                season: nextEp.season,
                episode: nextEp.episode,
                title: nextEp.title,
                episodeid: nextEp.episodeid,
                runtime: nextEp.runtime,
            };
            if (detailed) {
                nextUnwatched.tvdbid = detailed.uniqueid?.tvdb || null;
                nextUnwatched.imdbid = detailed.uniqueid?.imdb || null;
                nextUnwatched.tmdbid = detailed.uniqueid?.tmdb || null;
            }
        }

        return {
            tvshowid: ep.tvshowid,
            showtitle: ep.showtitle,
            lastplayed: ep.lastplayed,
            playcount: ep.playcount,
            nextUnwatched,
            tvdbid: detailed?.uniqueid?.tvdb || null,
            imdbid: detailed?.uniqueid?.imdb || null,
            tmdbid: detailed?.uniqueid?.tmdb || null,
        };
    });

    return finalList;
}





async function refreshKodiLibrary() {
    const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'VideoLibrary.Scan',
    };
    try
    {
        const response = await kodi.post('', payload);
        console.log('Kodi library refresh triggered:',response.statusText);
    } catch (err) {
        console.error('Error refreshing Kodi library:', err.message);
        throw err;
    }
}




/*

{
  "id": 5713,
  "seriesId": 70369,
  "name": "Blueprint for Murder",
  "aired": "1972-02-09",
  "seasonNumber": 1,
  "number": 9,
  "overview": "…",
  "finaleType": "season"
},
{
  "id": 5714,
  "seriesId": 70369,
  "name": "Étude in Black",
  "aired": "1972-09-17",
  "seasonNumber": 2,
  "number": 1,
  "finaleType": "none"
}

 */


module.exports = {
    getTVShows,
    getMostRecentEpisode,
    getEpisodeFromKodi,
    getLastPlayedTVShows,
    getTVShowDetail,
    getEpisodeDetailFromKodi,
    getNextUnWatchedEpisode,
    refreshKodiLibrary
};

