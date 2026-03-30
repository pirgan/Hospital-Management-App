/**
 * AI route rate limiter
 * Limits each authenticated user to 10 requests per minute on /api/ai/* routes.
 * This prevents runaway AI API costs and protects against abuse.
 *
 * Implementation uses an in-memory Map (store) keyed by user ID (or IP for edge cases).
 * Each entry tracks:
 *   - count: number of requests in the current window
 *   - resetAt: timestamp (ms) when the window expires and count resets
 *
 * Trade-off: the Map is process-local, so in a multi-instance deployment each
 * instance would have its own counter. For distributed rate limiting, replace
 * the Map with a Redis store (e.g. using ioredis).
 */

// In-memory store: userId → { count, resetAt }
const store = new Map();

/**
 * aiRateLimit — Express middleware enforcing 10 req/min per user on AI routes.
 *
 * Flow:
 *  1. Identify the caller by their user ID (from JWT) or fall back to IP.
 *  2. If no record exists, create one with count=1 and return next().
 *  3. If the window has expired, reset the counter and allow the request.
 *  4. If the count is at the limit, return 429 Too Many Requests.
 *  5. Otherwise, increment the counter and allow the request.
 */
export const aiRateLimit = (req, res, next) => {
  const userId = req.user?._id?.toString() ?? req.ip;
  const now = Date.now();
  const windowMs = 60_000; // 1-minute sliding window
  const max = 10;          // maximum requests per window

  // First request from this user — create a fresh record
  if (!store.has(userId)) {
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return next();
  }

  const record = store.get(userId);

  // Window has expired — reset and allow
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return next();
  }

  // Limit reached — reject the request
  if (record.count >= max) {
    return res.status(429).json({ message: 'Too many AI requests — try again in a minute' });
  }

  // Within limit — increment and allow
  record.count += 1;
  next();
};
