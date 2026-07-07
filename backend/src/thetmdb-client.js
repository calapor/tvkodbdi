// thetvdb-client.js
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getEpisodeRuntimeFromTMDb(tvShowName, seasonNumber, episodeNumber,tmdbId = null) {
    try {
        let tvShowId = null;
        if (tmdbId === null) {

            // Step 1: Search for the TV show
            console.log('TV ShowName :  ', tvShowName, ' Season: ', seasonNumber, ' Episode: ', episodeNumber);
            const searchRes = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
                params: {
                    query: tvShowName,
                    api_key: TMDB_API_KEY
                }
            });
            //console.log(searchRes.data);

            if (!searchRes.data.results.length) {
                throw new Error(`TV show "${tvShowName}" not found on TMDb.`);
            }

             tvShowId = searchRes.data.results[0].id;
        }
        else {
             tvShowId = tmdbId
        }
        // Step 2: Get the episode details
        const epRes = await axios.get(
            `https://api.themoviedb.org/3/tv/${tvShowId}/season/${seasonNumber}/episode/${episodeNumber}`,
            {
                params: {
                    api_key: TMDB_API_KEY
                }
            }
        );

        const runtime = epRes.data.runtime; // runtime in minutes
        if (runtime == null || isNaN(runtime) || runtime === 0) {
            // If runtime is not available, return 0
            return 0;
        }else {
            console.log(`Fetched runtime for ${tvShowName} S${seasonNumber}E${episodeNumber}: ${runtime} minutes`);
            return runtime * 60; // convert to seconds
        } // convert to seconds if available, else null
    } catch (error) {
        console.error(`Error fetching runtime from TMDb: ${error.message}`);
        return null;
    }
}

module.exports = getEpisodeRuntimeFromTMDb;



module.exports = {
    getEpisodeRuntimeFromTMDb
};
