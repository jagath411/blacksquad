import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

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

  // eslint-disable-next-line no-console
  console.error(`❌ [Error ${statusCode}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    message,
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
