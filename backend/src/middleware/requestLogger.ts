import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/** One log line per request, with an id that is also returned to the client for support. */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const entry = {
      requestId,
      method: req.method,
      // Path only: query strings can carry tokens.
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Date.now() - start,
    };
    if (res.statusCode >= 500) logger.error(entry, 'request failed');
    else if (res.statusCode >= 400) logger.warn(entry, 'request rejected');
    else logger.info(entry, 'request');
  });
  next();
};
