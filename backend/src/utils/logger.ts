import pino from 'pino';

/**
 * Structured JSON logs in production (one line per event, ready for CloudWatch or similar);
 * readable output in development. Never log tokens, codes or passwords.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'blacksquad-api' },
  redact: ['req.headers.authorization', '*.password', '*.otp', '*.token', '*.refreshToken', '*.accessToken'],
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});
