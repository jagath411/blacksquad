import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-process store: correct for a single server. Moves to Redis when the API runs on several instances.
const stores: Array<Map<string, RateLimitRecord>> = [];

setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, record] of store) {
      if (now > record.resetAt) store.delete(key);
    }
  }
}, 60_000).unref();

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const store = new Map<string, RateLimitRecord>();
  stores.push(store);

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    const record = store.get(key);
    if (!record || now > record.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    record.count += 1;
    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000).toString());
      res.status(429).json({ success: false, message, code: 'TOO_MANY_REQUESTS' });
      return;
    }

    next();
  };
}

export const apiRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300 });
