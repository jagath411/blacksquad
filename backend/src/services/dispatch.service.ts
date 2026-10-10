import type { Types } from 'mongoose';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { bookingRoom, customerRoom, driverRoom, getIO } from '../sockets';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';

/** How far from the pickup a driver can be offered a ride. */
export const DISPATCH_RADIUS_METERS = 10_000;
/** Drivers whose last GPS fix is older than this are treated as unreachable. */
export const DRIVER_FRESHNESS_MS = 5 * 60 * 1000;
/** How many of the nearest drivers are offered each ride at once. */
export const DISPATCH_BATCH_SIZE = 10;
/** A request nobody accepts within this time is cancelled. */
export const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export interface RideOffer {
  _id: string;
  pickupAddress: string;
  dropAddress: string;
  pickupLocation: unknown;
  dropLocation: unknown;
  serviceTier: string;
  fare: number;
  distanceKm?: number;
  createdAt: Date;
}

/** User ids of the nearest online drivers with a recent position, closest first. */
export async function findNearbyDriverUserIds(pickup: [number, number]): Promise<string[]> {
  const drivers = await DriverModel.find({
    availabilityStatus: 'AVAILABLE',
    lastLocationUpdate: { $gte: new Date(Date.now() - DRIVER_FRESHNESS_MS) },
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: pickup },
        $maxDistance: DISPATCH_RADIUS_METERS,
      },
    },
  })
    .select('userId')
    .limit(DISPATCH_BATCH_SIZE)
    .lean();
  return drivers.map((d) => (d.userId as Types.ObjectId).toString());
}

/** Offers a new ride to the nearest drivers. Returns how many were offered it. */
export async function offerRide(offer: RideOffer, pickup: [number, number]): Promise<number> {
  const io = getIO();
  const driverUserIds = await findNearbyDriverUserIds(pickup);
  if (io) {
    for (const userId of driverUserIds) io.to(driverRoom(userId)).emit('booking:new:request', offer);
  }
  // Drivers with the app in the background or the phone locked get a push as well.
  void notificationService.notifyRideOffer(driverUserIds, offer._id, offer.fare, offer.pickupAddress);
  return driverUserIds.length;
}

/** Cancels requests that nobody accepted in time and tells the customer. */
export async function expireUnansweredRequests(now = Date.now()): Promise<number> {
  const stale = await BookingModel.find({
    status: 'REQUESTED',
    createdAt: { $lt: new Date(now - REQUEST_TIMEOUT_MS) },
  })
    .select('_id customerId')
    .lean();

  let expired = 0;
  for (const booking of stale) {
    const updated = await BookingModel.findOneAndUpdate(
      { _id: booking._id, status: 'REQUESTED' },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(now),
          cancellationReason: 'No drivers available nearby',
        },
      },
      { new: true },
    ).lean();
    if (!updated) continue;
    expired += 1;

    const io = getIO();
    const bookingId = updated._id.toString();
    const payload = { bookingId, status: 'CANCELLED', booking: updated };
    io?.to(customerRoom(updated.customerId.toString())).emit('booking:status:change', payload);
    io?.to(bookingRoom(bookingId)).emit('booking:request:taken', { bookingId });
    void notificationService.notifyRider(updated.customerId.toString(), bookingId, 'CANCELLED', {
      reason: 'No drivers available nearby. Please try again.',
    });
  }
  return expired;
}

export function startRequestExpiry(intervalMs = 30_000): NodeJS.Timeout {
  const timer = setInterval(() => {
    expireUnansweredRequests().catch((err: unknown) => {
      logger.error({ detail: err instanceof Error ? err.message : err }, '[Dispatch] request expiry failed');
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
