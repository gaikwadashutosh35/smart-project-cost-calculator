import type { RequestHandler } from 'express';

/**
 * Fixed-window rate limit with a per-IP cap and a global cap (the global cap bounds API spend).
 * In-memory: limits are per server process and reset on restart.
 * ponytail: per-process memory store and per-address IPv6 keys; move to Redis / subnet keys if you run several instances.
 */
export function rateLimit(opts: { perIp: number; global: number; windowMs: number }, now = Date.now): RequestHandler {
  let resetAt = 0;
  let total = 0;
  const perIp = new Map<string, number>(); // only allowed requests are stored, so size <= opts.global

  return (req, res, next) => {
    const t = now();
    if (t >= resetAt) {
      resetAt = t + opts.windowMs;
      total = 0;
      perIp.clear();
    }
    const ip = req.ip ?? 'unknown';
    const count = perIp.get(ip) ?? 0;
    if (count >= opts.perIp || total >= opts.global) {
      const seconds = Math.ceil((resetAt - t) / 1000);
      const minutes = Math.ceil(seconds / 60);
      res.set('Retry-After', String(seconds));
      res.status(429).json({ available: true, error: `Too many Claude requests — try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
      return;
    }
    perIp.set(ip, count + 1);
    total++;
    next();
  };
}
