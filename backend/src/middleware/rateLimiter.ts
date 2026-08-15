import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = memoryStore.get(key);
    if (!record || now > record.resetAt) {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      res.status(429).json({ success: false, message, code: 'TOO_MANY_REQUESTS' });
      return;
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
export const apiRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
