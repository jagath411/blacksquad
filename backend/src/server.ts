import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { dbService } from './config/database';

const startServer = async (): Promise<http.Server> => {
  // Attempt MongoDB connection gracefully (failure won't crash the server)
  await dbService.connect();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 BlackSquad Backend Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    // eslint-disable-next-line no-console
    console.log(`📡 Health Check URL: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      // eslint-disable-next-line no-console
      console.log('🔒 HTTP server closed.');
      await dbService.disconnect();
      // eslint-disable-next-line no-console
      console.log('👋 BlackSquad backend service terminated cleanly.');
      process.exit(0);
    });

    // Force shutdown if cleanup takes too long
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('⚠️ Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason: unknown) => {
    // eslint-disable-next-line no-console
    console.error('❌ Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('❌ Uncaught Exception:', error.message);
    void shutdown('uncaughtException');
  });

  return server;
};

// Start the server if executed directly
if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { startServer };
