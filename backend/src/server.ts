import './instrument';
import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { dbService } from './config/database';
import { locationState } from './services/location.service';
import { attachSockets } from './sockets';
import { startRequestExpiry } from './services/dispatch.service';
import { logger } from './utils/logger';

const startServer = async (): Promise<http.Server> => {
  await dbService.connect();

  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server);
  startRequestExpiry();

  if (dbService.isConnected()) {
    await locationState.loadFromDatabase();
  }

  server.listen(env.PORT, () => {
    logger.info(`🚀 BlackSquad Backend Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📡 Health Check URL: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      await dbService.disconnect();
      logger.info('✅ Server closed and database disconnected.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('⚠️ Forcefully terminating after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return server;
};

const isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  (process.argv[1] ? process.argv[1].endsWith('server.ts') : false);
if (isMain && process.env.NODE_ENV !== 'test') {
  void startServer();
}
