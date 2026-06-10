// concurrency.js - tiny bounded-concurrency helper (no external dependency)

/**
 * Map `fn` over `items` with at most `limit` invocations in flight at once.
 * Results are returned in the same order as `items`. Unlike Promise.all over a
 * full map, this caps fan-out so we don't hammer TheTVDB / Kodi with hundreds
 * of simultaneous requests (and risk rate limiting), while still running far
 * faster than a fully serial loop.
 *
 * `fn(item, index)` may throw/reject; rejections propagate to the caller, so
 * wrap per-item work in try/catch if you want "skip on error" semantics.
 */
async function runPool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;

    const worker = async () => {
        while (true) {
            const index = next++;
            if (index >= items.length) return;
            results[index] = await fn(items[index], index);
        }
    };

    const workers = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results;
}

module.exports = { runPool };
