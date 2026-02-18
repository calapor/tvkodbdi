// cache.js - File-based persistent cache with TTL and stale fallback
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const TVDB_CACHE_FILE = path.join(CACHE_DIR, 'tvdb.json');
const RESPONSES_CACHE_FILE = path.join(CACHE_DIR, 'responses.json');

// Time-to-live constants (milliseconds)
const TTL = {
    SERIES_INFO: 24 * 60 * 60 * 1000,   // 24 hours - series metadata changes rarely
    EPISODES:     6 * 60 * 60 * 1000,   //  6 hours - episode schedules change occasionally
    FAVORITES:   30 * 60 * 1000,        // 30 minutes - user's favorites list
    RESPONSE:    60 * 60 * 1000,        //  1 hour  - full processed endpoint response
};

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

class FileCache {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = this._load();
    }

    _load() {
        try {
            ensureCacheDir();
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            }
        } catch (e) {
            console.warn(`⚠️ Cache load failed (${this.filePath}):`, e.message);
        }
        return {};
    }

    _save() {
        try {
            ensureCacheDir();
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.warn(`⚠️ Cache save failed (${this.filePath}):`, e.message);
        }
    }

    /** Returns cached value only if still within TTL, otherwise null */
    get(key) {
        const entry = this.data[key];
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) return null;
        return entry.value;
    }

    /** Returns cached value regardless of TTL expiry (offline fallback) */
    getStale(key) {
        const entry = this.data[key];
        if (!entry) return null;
        return entry.value;
    }

    /** Returns cache metadata (cachedAt timestamp) for a key */
    getMeta(key) {
        const entry = this.data[key];
        if (!entry) return null;
        return { cachedAt: entry.cachedAt, expiresAt: entry.expiresAt };
    }

    set(key, value, ttl) {
        this.data[key] = {
            value,
            cachedAt: Date.now(),
            expiresAt: Date.now() + ttl,
        };
        this._save();
    }

    has(key) {
        return this.get(key) !== null;
    }
}

const tvdbCache = new FileCache(TVDB_CACHE_FILE);
const responseCache = new FileCache(RESPONSES_CACHE_FILE);

module.exports = { tvdbCache, responseCache, TTL };
