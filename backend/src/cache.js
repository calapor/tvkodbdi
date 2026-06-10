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
        this._dirty = false;
        this._saveTimer = null;
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

    /**
     * Persist the cache to disk. Coalesces the many set() calls made while
     * serving a single request into one debounced, non-blocking write so we
     * don't synchronously rewrite the whole file (and block the event loop)
     * on every individual set().
     */
    _save() {
        this._dirty = true;
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._flush();
        }, 50);
        // Don't let a pending cache write keep the process alive.
        if (this._saveTimer.unref) this._saveTimer.unref();
    }

    /** Write the cache to disk immediately (used by the debounced flush). */
    _flush() {
        if (!this._dirty) return;
        this._dirty = false;
        try {
            ensureCacheDir();
            fs.writeFileSync(this.filePath, JSON.stringify(this.data));
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

    /**
     * Returns the age of a cached entry as a fraction of its total TTL
     * (0 = just written, 1 = exactly at expiry, >1 = expired). Null if absent.
     * Used for stale-while-revalidate decisions.
     */
    ageFraction(key) {
        const entry = this.data[key];
        if (!entry) return null;
        const ttl = entry.expiresAt - entry.cachedAt;
        if (ttl <= 0) return 1;
        return (Date.now() - entry.cachedAt) / ttl;
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
