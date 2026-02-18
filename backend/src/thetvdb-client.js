// thetvdb-client.js
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const tvdb_api_key = process.env.TVDB_API_KEY;

let token = null;

async function authenticate() {
    const response = await axios.post(
        'https://api4.thetvdb.com/v4/login',
        { apikey: tvdb_api_key }
    );
    token = response.data.data.token;
}

async function fetchFavorites() {
    if (!token) await authenticate();

    const response = await axios.get(
        'https://api4.thetvdb.com/v4/user/favorites',
        { headers: { Authorization: `Bearer ${token}` } }
    );

    const seriesIds = response.data.data.series;
    return Array.isArray(seriesIds) ? seriesIds : [];
}

async function getEpisodesForSeries(seriesId) {
    if (!token) await authenticate();

    let allEpisodes = [];
    let page = 0;
    let hasMore = true;

    try {
        //while (hasMore) {
            const response = await axios.get(
                `https://api4.thetvdb.com/v4/series/${seriesId}/episodes/default`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const episodes = response.data.data.episodes || [];  // <-- declare before use
            if (episodes.length > 0) {
                allEpisodes = allEpisodes.concat(episodes);
            } else {
                hasMore = false;
            }
        //}
    } catch (err) {
        console.warn(`⚠️ Error fetching episodes for series ${seriesId}:`, err.response?.status || err.message);
        return [];
    }

    return allEpisodes;
}


async function getSeriesStatus(seriesId) {
    const results = [];
    const active = [];
    const ended = [];
    try {

        const response = await axios.get(`https://api4.thetvdb.com/v4/series/${seriesId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.data.status !== "Ended")
        {
          ended.push(
            {
                id: seriesId,
                name: response.data.data.name,
                status: response.data.data.status,
            }
          )
        }
        else
        {
            active.push(
                {
                    id: seriesId,
                    name: response.data.data.name,
                    status: response.data.data.status,
                }
            )
        }
            results.push({
                id: seriesId,
                name: response.data.data.name,
                status: response.data.data.status,
            });

    }catch (err) {
        console.warn(`⚠️ Error fetching episodes for series ${seriesId}:`, err.response?.status || err.message);
        return [];
    }
    return results;
}

async function getSeriesInfo(seriesId) {
    if (!token) await authenticate();

    const response = await axios.get(
        `https://api4.thetvdb.com/v4/series/${seriesId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data || {};
}









async function getEpisodeInfo(seriesId,seasonNumber,episodeNumber) {
    const episodes = await getEpisodesForSeries(seriesId);
    if (!episodes || episodes.length === 0) {
        return {};
    }
    const episode = episodes.find(ep => ep.seasonNumber === seasonNumber && ep.number === episodeNumber);
    return episode || {};

}


module.exports = {
    fetchFavorites,
    getEpisodesForSeries,
    getSeriesInfo,
    getSeriesStatus,
    getEpisodeInfo
};
