// thetvdb-client.js
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { tvdbCache, TTL } = require('./cache');

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
    const cacheKey = 'favorites:list';
    const cached = tvdbCache.get(cacheKey);
    if (cached) return cached;

    try {
        if (!token) await authenticate();

        const response = await axios.get(
            'https://api4.thetvdb.com/v4/user/favorites',
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const seriesIds = response.data.data.series;
        const result = Array.isArray(seriesIds) ? seriesIds : [];
        tvdbCache.set(cacheKey, result, TTL.FAVORITES);
        return result;
    } catch (err) {
        const stale = tvdbCache.getStale(cacheKey);
        if (stale) {
            console.warn('⚠️ TVDB unreachable — using cached favorites list');
            return stale;
        }
        throw err;
    }
}

async function getEpisodesForSeries(seriesId) {
    const cacheKey = `episodes:${seriesId}`;
    const cached = tvdbCache.get(cacheKey);
    if (cached) return cached;

    let allEpisodes = [];

    try {
        if (!token) await authenticate();

        const response = await axios.get(
            `https://api4.thetvdb.com/v4/series/${seriesId}/episodes/default`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const episodes = response.data.data.episodes || [];
        if (episodes.length > 0) {
            allEpisodes = allEpisodes.concat(episodes);
        }
        tvdbCache.set(cacheKey, allEpisodes, TTL.EPISODES);
        return allEpisodes;
    } catch (err) {
        console.warn(`⚠️ Error fetching episodes for series ${seriesId}:`, err.response?.status || err.message);
        const stale = tvdbCache.getStale(cacheKey);
        if (stale) {
            console.warn(`⚠️ Using cached episodes for series ${seriesId}`);
            return stale;
        }
        return [];
    }
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
    const cacheKey = `series:${seriesId}`;
    const cached = tvdbCache.get(cacheKey);
    if (cached) return cached;

    try {
        if (!token) await authenticate();

        const response = await axios.get(
            `https://api4.thetvdb.com/v4/series/${seriesId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = response.data.data || {};
        tvdbCache.set(cacheKey, data, TTL.SERIES_INFO);
        return data;
    } catch (err) {
        const stale = tvdbCache.getStale(cacheKey);
        if (stale) {
            console.warn(`⚠️ TVDB unreachable — using cached series info for ${seriesId}`);
            return stale;
        }
        return {};
    }
}


async function getEpisodeInfo(seriesId, seasonNumber, episodeNumber) {
    try {
        const episodes = await getEpisodesForSeries(seriesId);
        if (!episodes || episodes.length === 0) {
            return {};
        }
        const episode = episodes.find(ep => ep.seasonNumber === seasonNumber && ep.number === episodeNumber);
        return episode || {};
    } catch (err) {
        console.error(`Failed to get episode info for series ${seriesId} S${seasonNumber}E${episodeNumber}:`, err.message);
        return {};
    }
}


module.exports = {
    fetchFavorites,
    getEpisodesForSeries,
    getSeriesInfo,
    getSeriesStatus,
    getEpisodeInfo
};
