import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV !== 'test') dotenv.config();

// Error tracking is on only when SENTRY_DSN is set. This file must be imported before anything else.
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Request bodies can hold codes and bank details.
    sendDefaultPii: false,
  });
}
