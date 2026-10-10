import type http from 'http';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { locationState } from '../services/location.service';
import type { AuthUser } from '../types/auth';
import type { PopulatedRef } from '../types/populated';
import { errorMessage } from '../utils/errors';

let io: SocketIOServer | null = null;

/** The live Socket.IO server, or null before it is attached (and in HTTP-only tests). */
export const getIO = (): SocketIOServer | null => io;

export const ownerRoom = (ownerId: string) => `owner:${ownerId}`;
export const bookingRoom = (bookingId: string) => `booking:${bookingId}`;
export const customerRoom = (userId: string) => `customer:${userId}`;
export const driverRoom = (userId: string) => `driver:${userId}`;
export const AVAILABLE_DRIVERS_ROOM = 'drivers:available';

const locationPayload = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.number().int().positive(),
});

const ACTIVE_STATUSES = ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'];

/** A user may watch a booking if they are its customer, its driver, or the owner of its driver. */
async function canWatchBooking(user: AuthUser, bookingId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(bookingId)) return false;
  const booking = await BookingModel.findById(bookingId).select('customerId driverId status').lean();
  if (!booking || !ACTIVE_STATUSES.includes(booking.status)) return false;
  if (user.role === 'CUSTOMER') return booking.customerId.toString() === user.id;
  if (!booking.driverId) return false;
  const driver = await DriverModel.findById(booking.driverId).select('userId ownerId').lean();
  if (!driver) return false;
  if (user.role === 'DRIVER') return driver.userId.toString() === user.id;
  return driver.ownerId?.toString() === user.id;
}

function registerHandlers(server: SocketIOServer, socket: Socket): void {
  const user = socket.data.user as AuthUser;

  socket.on('booking:join', async (bookingId: unknown) => {
    if (typeof bookingId !== 'string') return;
    try {
      if (await canWatchBooking(user, bookingId)) await socket.join(bookingRoom(bookingId));
    } catch (err) {
      console.error('[Socket] booking:join failed:', errorMessage(err));
    }
  });

  socket.on('booking:leave', (bookingId: unknown) => {
    if (typeof bookingId === 'string') void socket.leave(bookingRoom(bookingId));
  });

  socket.on('driver:location', async (payload: unknown) => {
    if (user.role !== 'DRIVER') return;
    const parsed = locationPayload.safeParse(payload);
    if (!parsed.success) return;

    try {
      const result = await locationState.update({ ...parsed.data, driverId: user.id });
      if (!result.accepted) return;

      if (result.ownerId) server.to(ownerRoom(result.ownerId)).emit('fleet:location', result.location);

      // Only the server decides which trip a driver is on.
      if (result.activeBookingId) {
        server.to(bookingRoom(result.activeBookingId)).emit('booking:location:update', {
          bookingId: result.activeBookingId,
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
    } catch (err) {
      console.error('[Socket] driver:location failed:', errorMessage(err));
    }
  });

  socket.on('driver:status', async (status: unknown) => {
    if (user.role !== 'DRIVER') return;
    const normalized = status === 'AVAILABLE' ? 'AVAILABLE' : 'OFFLINE';
    try {
      // A driver on a trip stays ON_TRIP until the trip ends.
      const driver = await DriverModel.findOneAndUpdate(
        { userId: user.id, availabilityStatus: { $ne: 'ON_TRIP' } },
        { $set: { availabilityStatus: normalized } },
        { new: true },
      ).lean();
      if (!driver) return;

      if (normalized === 'AVAILABLE') await socket.join(AVAILABLE_DRIVERS_ROOM);
      else await socket.leave(AVAILABLE_DRIVERS_ROOM);

      if (driver.ownerId) {
        server.to(ownerRoom(driver.ownerId.toString())).emit('fleet:driver:status', {
          driverId: user.id,
          status: normalized,
        });
      }
    } catch (err) {
      console.error('[Socket] driver:status failed:', errorMessage(err));
    }
  });

  socket.on('owner:fleet:subscribe', async () => {
    if (user.role !== 'OWNER') return;
    try {
      const drivers = await DriverModel.find({ ownerId: user.id })
        .populate('userId', 'name phoneNumber')
        .populate('vehicleId', 'registrationNumber model')
        .lean();

      const snapshot = drivers.map((d) => {
        const driverUser = d.userId as unknown as PopulatedRef;
        const vehicle = d.vehicleId as unknown as PopulatedRef | undefined;
        const driverUserId = driverUser?._id?.toString() || d.userId.toString();
        const live = locationState.get(driverUserId);
        const coords = d.currentLocation?.coordinates;
        return {
          driverId: driverUserId,
          driverName: driverUser?.name || 'Driver Partner',
          driverPhone: driverUser?.phoneNumber || '',
          vehiclePlate: vehicle?.registrationNumber || '',
          vehicleModel: vehicle?.model || '',
          status: d.availabilityStatus || 'OFFLINE',
          // Drivers with no known position have none; the app must not invent one.
          latitude: live?.latitude ?? (coords ? coords[1] : null),
          longitude: live?.longitude ?? (coords ? coords[0] : null),
          speed: live?.speed,
          heading: live?.heading,
          receivedAt: live?.receivedAt || d.lastLocationUpdate?.toISOString() || null,
        };
      });

      socket.emit('fleet:snapshot', snapshot);
    } catch (err) {
      console.error('[Socket] owner:fleet:subscribe failed:', errorMessage(err));
      socket.emit('fleet:snapshot', []);
    }
  });
}

export function attachSockets(httpServer: http.Server): SocketIOServer {
  const server = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()) },
  });

  server.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
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

  server.on('connection', async (socket) => {
    const user = socket.data.user as AuthUser;
    registerHandlers(server, socket);

    try {
      if (user.role === 'OWNER') {
        await socket.join(ownerRoom(user.id));
      } else if (user.role === 'CUSTOMER') {
        await socket.join(customerRoom(user.id));
      } else if (user.role === 'DRIVER') {
        await socket.join(driverRoom(user.id));
        const driver = await DriverModel.findOne({ userId: user.id }).select('availabilityStatus').lean();
        if (driver?.availabilityStatus === 'AVAILABLE') await socket.join(AVAILABLE_DRIVERS_ROOM);
      }
    } catch (err) {
      console.error('[Socket] room setup failed:', errorMessage(err));
    }
  });

  io = server;
  return server;
}
