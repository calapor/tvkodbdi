// kodi-client.js
const axios = require('axios');
const dotenv = require('dotenv');
//const fetch = require('node-fetch');
const { fetchSeriesThumbnailAndSeasonFinale } = require('./thetvdb-client');


dotenv.config();

const kodi_host =  process.env.KODI_HOST;
const kodi_username = process.env.KODI_USERNAME;
const kodi_password = process.env.KODI_PASSWORD;
console.log({kodi_host, kodi_username, kodi_password});
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
 Get a list of TV shows that were most recently played
 */

async function getRecentShowsWithUnwatchedEpisodes() {
    //const response = await axios.post('http://<your-kodi-host>:8080/jsonrpc', {
    const payload = {
        jsonrpc: '2.0',
        method: 'VideoLibrary.GetTVShows',
        params: {
            properties: [ 'title', 'playcount', 'lastplayed','imdbnumber'],
            filter: {
                field: 'playcount',
                operator: 'is',
                value: '0',
            },
            sort: {
                order: 'descending',
                method: 'lastplayed',
            },
            limits: {
                start: 0,
                end: 20
            }
        },
        id: 1
    };
    const response = await kodi.post('', payload);
    const tvs = response.data.result.tvshows || [];
    //return response.data.result.tvshows || [];
    for (const show of tvs){
        const latestWatchedEpisodes = getMostRecentWatchedEpisode(show.tvshowid);
        const latestUnwatchedEpisodes = getMostRecentEpisode(show.tvshowid);
    }
    return [];
    }



/*
 Get a list of TV shows that were most recently played
 */

async function getRecentShowsWithUnwatchedEpisodes2() {
    //const response = await axios.post('http://<your-kodi-host>:8080/jsonrpc', {
        const payload = {
        jsonrpc: '2.0',
        method: 'VideoLibrary.GetEpisodes',
            params: {
                properties: ['playcount', 'resume', 'title', 'season', 'episode', 'showtitle', 'file', 'tvshowid', 'lastplayed'],
                filter: {
                    field: 'inprogress',
                    operator: 'true'
                },filter: {
                    field: 'playcount',
                    operator: 'is',
                    value: '0',
                },
                limits: {
                    start: 0,
                    end: 25
                },
                sort: {
                    order: 'descending',
                    method: 'lastplayed'
                }
            },
        id: 1
    };
    const response = await kodi.post('', payload);
    const episodes = response.data.result.episodes || [];

    // Group by tvshowid and pick the most recent unwatched episode per show
    const showsMap = new Map();

    for (const ep of episodes) {
        if (!showsMap.has(ep.tvshowid)) {
            showsMap.set(ep.tvshowid, {
                tvshowid: ep.tvshowid,
                showtitle: ep.showtitle,
                lastplayed: ep.lastplayed,
                nextUnwatched: {
                    season: ep.season,
                    episode: ep.episode,
                    title: ep.title
                }
            });
        }
    }
    // Convert map to array and sort by lastplayed
    const shows = Array.from(showsMap.values())
        .sort((a, b) => new Date(b.lastplayed) - new Date(a.lastplayed))
        .slice(0, 20);
console.log(`This is what we have :`, shows);
    return shows;
}







async function getInProgressTVShows() {
    // Step 1: Get all in-progress episodes
    //const episodesResponse = await fetch(KODI_URL, {
    //    method: 'POST',
    //    headers: { 'Content-Type': 'application/json' },
    //    body: JSON.stringify({
    const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'VideoLibrary.GetEpisodes',
        params: {
            properties: [
                'title',
                'season',
                'episode',
                'tvshowid',
                'showtitle',
                'playcount',
                'resume',
                'lastplayed'
            ],
            filter: {
                field: 'playcount',
                operator: 'lessthan',
                value: '1'
            },
            sort: {
                method: 'lastplayed',
                order: 'descending'
            },
            limits: { start: 0, end: 200 }
        }

    };
    const result = await kodi.post('', payload);
    const episodes = result.data.result.episodes || [];
    const inProgressEpisodes = episodes.filter(ep => ep.resume && ep.resume.position > 0);
    // Step 2: Group by tvshowid
    const grouped = {};
    for (const ep of inProgressEpisodes) {
        const id = ep.tvshowid;
        if (!grouped[id] || new Date(ep.lastplayed) > new Date(grouped[id].lastplayed)) {
            grouped[id] = ep;
        }
    }

    const tvshowIds = Object.keys(grouped).map(id => Number(id));

    // Step 3: Fetch show details
    const batchPayload = tvshowIds.map((id, idx) => ({
        jsonrpc: '2.0',
        id: idx + 2,
        method: 'VideoLibrary.GetTVShowDetails',
        params: {
            tvshowid: id,
            properties: ['title', 'thumbnail', 'lastplayed', 'art', 'file']
        }
    }));
    const tvshowResponse = await kodi.post('', batchPayload);
    console.log(tvshowResponse.data.episodes);
    const batchResults = tvshowResponse.data;
   // const tvshowResponse = await fetch(KODI_URL, {
   //     method: 'POST',
   //     headers: { 'Content-Type': 'application/json' },
   //     body: JSON.stringify(batchPayload)
    //});
//const tvshows = tvshowResponse;
    //const temp = tvshowResponse.data.result.episodes || [];
//console.log(temp)
const tvshows =  tvshowResponse.data.result;

    // Step 4: Map and sort
    const resultList = batchResults.map(res => {
        const show = res.result.tvshowdetails;
        const ep = grouped[show.tvshowid];
        return {
            id: show.tvshowid,
            title: show.title,
            thumbnail: show.thumbnail,
            lastplayed: ep.lastplayed,
            episodeTitle: ep.title,
            season: ep.season,
            episode: ep.episode
        };
    }).sort((a, b) => new Date(b.lastplayed) - new Date(a.lastplayed));
console.log(resultList)
    return resultList;
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
console.log("made it here");
    const response = await kodi.post('', payload);
    console.log("made it here2");

    const episodes = response.data?.result?.episodes || [];

    const orderedTVShowsMap = new Map();
    const processedShowIds = new Set();

    for (const ep of episodes) {

        // Skip in-progress episodes
       // if (ep.resume?.position > 0) {
       //     console.log(`⏭ Skipping in-progress: ${ep.showtitle} S${ep.season}E${ep.episode}`);
       //     continue;
       // }
        let nextUnwatched = null;

        //if (ep.playcount === 0) {
        //    // This episode itself is unwatched
        //    nextUnwatched = {
        //        season: ep.season,
        //        episode: ep.episode,
        //        title: ep.title,
        //        episodeid: ep.episodeid,
        //        runtime: ep.runtime
        //    };
        //} else {    // REMOVED THIS ON 3 SEPT 2025
            // Otherwise, try to find the next unwatched episode

           if (processedShowIds.has(ep.tvshowid)) {
               // Already processed this show
               continue;
           }
           processedShowIds.add(ep.tvshowid);

            console.log(`🔍 Finding next unwatched for: ${ep.showtitle}`);

            const nextEp = await getNextUnWatchedEpisode(ep.tvshowid);
            if (nextEp) {
                nextUnwatched = {
                    season: nextEp.season,
                    episode: nextEp.episode,
                    title: nextEp.title,
                    episodeid: nextEp.episodeid,
                    runtime: nextEp.runtime
                };
                const showInfo = await getTVShowDetail(ep.tvshowid);
                if (showInfo) {
                    nextUnwatched.tvdbid = showInfo.uniqueid?.tvdb || null;
                    nextUnwatched.imdbid = showInfo.uniqueid?.imdb || null;
                    nextUnwatched.tmdbid = showInfo.uniqueid?.tmdb || null;
                }
                console.log(`   ➡️ Next unwatched for ${ep.showtitle}: S${nextEp.season}E${nextEp.episode} - ${nextEp.title}`);
            } else {
                console.log(`   ➡️ No unwatched episodes found for ${ep.showtitle}`);
            }
        //}


        orderedTVShowsMap.set(ep.tvshowid, {
            tvshowid: ep.tvshowid,
            showtitle: ep.showtitle,
            lastplayed: ep.lastplayed,
            playcount: ep.playcount,
            nextUnwatched
        });
    }
    // Add TVDB/IMDB/TMDB IDs
    for (const show of orderedTVShowsMap.values()) {
        const detailed = await getTVShowDetail(show.tvshowid);
        if (detailed) {
            show.tvdbid = detailed.uniqueid?.tvdb || null;
            show.imdbid = detailed.uniqueid?.imdb || null;
            show.tmdbid = detailed.uniqueid?.tmdb || null;
        }
    }
    const finalList = Array.from(orderedTVShowsMap.values());
    //console.log('✅ Final last played TV shows:', finalList);

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
    getRecentShowsWithUnwatchedEpisodes,
    getEpisodeDetailFromKodi,
    getNextUnWatchedEpisode,
    getInProgressTVShows,
    refreshKodiLibrary
};

