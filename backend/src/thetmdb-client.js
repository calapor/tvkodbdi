// thetmdb-client.js
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const tmdb = axios.create({
    baseURL: 'https://api.themoviedb.org/3',
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
});

async function getEpisodeRuntimeFromTMDb(tvShowName, seasonNumber, episodeNumber, tmdbId = null) {
    try {
        let tvShowId = null;
        if (tmdbId === null) {
            console.log('TV ShowName :  ', tvShowName, ' Season: ', seasonNumber, ' Episode: ', episodeNumber);
            const searchRes = await tmdb.get('/search/tv', {
                params: { query: tvShowName }
            });

            if (!searchRes.data.results.length) {
                throw new Error(`TV show "${tvShowName}" not found on TMDb.`);
            }

            tvShowId = searchRes.data.results[0].id;
        } else {
            tvShowId = tmdbId;
        }

        const epRes = await tmdb.get(`/tv/${tvShowId}/season/${seasonNumber}/episode/${episodeNumber}`);

        const runtime = epRes.data.runtime; // runtime in minutes
        if (runtime == null || isNaN(runtime) || runtime === 0) {
            return 0;
        } else {
            console.log(`Fetched runtime for ${tvShowName} S${seasonNumber}E${episodeNumber}: ${runtime} minutes`);
            return runtime * 60; // convert to seconds
        }
    } catch (error) {
        console.error(`Error fetching runtime from TMDb: ${error.message}`);
        return null;
    }
}

module.exports = { getEpisodeRuntimeFromTMDb };
