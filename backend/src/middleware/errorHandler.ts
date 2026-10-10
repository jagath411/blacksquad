import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  type?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isMalformedJson = err.type === 'entity.parse.failed';
  const statusCode = err instanceof ZodError || isMalformedJson ? 400 : err.statusCode || 500;
  const message =
    isMalformedJson
      ? 'Request body must be valid JSON'
      : err instanceof ZodError
      ? 'Request validation failed'
      : statusCode >= 500
      ? 'An unexpected server error occurred'
      : err.message || 'Request failed';

  if (statusCode >= 500) {
    logger.error({ err }, 'unhandled error');
    Sentry.captureException(err);
  }

  const code = isMalformedJson
    ? 'INVALID_JSON'
    : err instanceof ZodError
      ? 'VALIDATION_ERROR'
      : statusCode >= 500
        ? 'SERVER_ERROR'
        : `HTTP_${statusCode}`;

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(err instanceof ZodError && {
      issues: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
};
