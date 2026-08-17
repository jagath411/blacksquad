import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createApp } from './app';
import { env } from './config/env';
import { dbService } from './config/database';
import { locationState } from './services/location.service';
import type { AuthUser } from './types/auth';

export let io: SocketIOServer | null = null;

const startServer = async (): Promise<http.Server> => {
  // Attempt MongoDB connection gracefully
  await dbService.connect();

  const app = createApp();
  const server = http.createServer(app);

  io = new SocketIOServer(server, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
  });

  if (dbService.isConnected()) {
    await locationState.loadFromDatabase();
  }

  // Socket Authentication Middleware
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

    // Join role-based rooms
    if (user.role === 'OWNER') {
      socket.join('owners');
    } else if (user.role === 'DRIVER') {
      socket.join(`driver:${user.id}`);
      socket.join('drivers:available');
    } else if (user.role === 'CUSTOMER') {
      socket.join(`customer:${user.id}`);
    }

    // 1. Join / Leave active booking room for sub-second trip updates
    socket.on('booking:join', (bookingId: string) => {
      if (typeof bookingId === 'string' && bookingId.length > 0) {
        socket.join(`booking:${bookingId}`);
        // eslint-disable-next-line no-console
        console.log(`🔌 User ${user.email} (${user.role}) joined booking room: booking:${bookingId}`);
      }
    });

    socket.on('booking:leave', (bookingId: string) => {
      if (typeof bookingId === 'string' && bookingId.length > 0) {
        socket.leave(`booking:${bookingId}`);
        // eslint-disable-next-line no-console
        console.log(`🔌 User ${user.email} left booking room: booking:${bookingId}`);
      }
    });

    // 2. Driver live GPS telemetry broadcast
    socket.on('driver:location', async (payload: unknown) => {
      if (user.role !== 'DRIVER' || !payload || typeof payload !== 'object') return;
      const value = payload as Record<string, unknown>;
      if (
        typeof value.latitude !== 'number' ||
        typeof value.longitude !== 'number' ||
        typeof value.timestamp !== 'number'
      ) {
        return;
      }

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
        // Broadcast to Owner Fleet Dashboard
        io?.to('owners').emit('fleet:location', result.location);
        io?.emit('driver:location:update', result.location);

        // If driver is on an active trip, broadcast live location directly into the booking room
        const activeBookingId =
          result.activeBookingId ||
          (typeof value.bookingId === 'string' ? value.bookingId : undefined);

        if (activeBookingId) {
          io?.to(`booking:${activeBookingId}`).emit('booking:location:update', {
            bookingId: activeBookingId,
            driverId: user.id,
            driverName: result.location.driverName,
            latitude: result.location.latitude,
            longitude: result.location.longitude,
            speed: result.location.speed,
            heading: result.location.heading,
            accuracy: result.location.accuracy,
            etaMinutes: result.etaMinutes,
            distanceKm: result.distanceKm,
            timestamp: result.location.timestamp,
          });
        }
      }
    });

    // 3. Driver Duty Status toggle (online/offline)
    socket.on('driver:status', (status: string) => {
      if (user.role === 'DRIVER') {
        if (status === 'AVAILABLE') {
          socket.join('drivers:available');
        } else {
          socket.leave('drivers:available');
        }
      }
    });

    // 4. Owner fleet snapshots
    socket.on('owner:fleet:subscribe', () => {
      if (user.role === 'OWNER') {
        socket.emit('fleet:snapshot', locationState.all());
      }
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
      await dbService.disconnect();
      // eslint-disable-next-line no-console
      console.log('✅ Server closed and database disconnected.');
      process.exit(0);
    });

    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('⚠️ Forcefully terminating after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return server;
};

void startServer();
