import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRateLimiter } from './middleware/rateLimiter';

export const createApp = (): Application => {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  // Security and utility middleware
  app.use(helmet({ crossOriginOpenerPolicy: false, contentSecurityPolicy: false, originAgentCluster: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
    }),
  );

  // Before body parsing, so rejected bodies are logged too.
  if (env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use(env.API_PREFIX, apiRateLimiter, apiRouter);

  // Serve the browser build through the same public port as the API.
  // Keeping /api separate lets mobile clients use the API while browser users
  // can test the app without requiring a second inbound security-group port.
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist, { index: 'index.html' }));

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
};
