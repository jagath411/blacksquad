import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createApp } from './app';
import { env } from './config/env';
import { dbService } from './config/database';
import { locationState } from './services/location.service';
import type { AuthUser } from './types/auth';

const startServer = async (): Promise<http.Server> => {
  // Attempt MongoDB connection gracefully (failure won't crash the server)
  await dbService.connect();

  const app = createApp();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
  });
  if (dbService.isConnected()) await locationState.loadFromDatabase();

  io.use((socket, next) => {
    const token =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      socket.data.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    if (user.role === 'OWNER') socket.join('owners');

    socket.on('booking:join', (bookingId: string) => {
      if (typeof bookingId === 'string' && bookingId.length > 0) {
        socket.join(`booking:${bookingId}`);
      }
    });

    socket.on('driver:location', async (payload: unknown) => {
      if (user.role !== 'DRIVER' || !payload || typeof payload !== 'object') return;
      const value = payload as Record<string, unknown>;
      if (
        typeof value.latitude !== 'number' ||
        typeof value.longitude !== 'number' ||
        typeof value.timestamp !== 'number'
      )
        return;
      const result = await locationState.update({
        driverId: user.id,
        latitude: value.latitude,
        longitude: value.longitude,
        timestamp: value.timestamp,
        speed: typeof value.speed === 'number' ? value.speed : undefined,
        heading: typeof value.heading === 'number' ? value.heading : undefined,
        accuracy: typeof value.accuracy === 'number' ? value.accuracy : undefined,
      });
      if (result.accepted) {
        io.to('owners').emit('fleet:location', result.location);
        io.emit('driver:location:update', result.location);
      }
    });
    socket.on('owner:fleet:subscribe', () => {
      if (user.role === 'OWNER') socket.emit('fleet:snapshot', locationState.all());
    });
  });

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
