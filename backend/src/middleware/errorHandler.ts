import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err instanceof ZodError ? 400 : err.statusCode || 500;
  const message =
    err instanceof ZodError ? 'Request validation failed' : err.message || 'Internal Server Error';

  // eslint-disable-next-line no-console
  console.error(`❌ [Error ${statusCode}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
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
