import { env } from '../config/env';
import { UserModel } from '../models/User';
import type { BookingStatus } from '../models/Booking';
import { errorMessage } from '../utils/errors';

export interface NotificationPayload {
  title: string;
  body: string;
  /** Delivered to the app with the notification; the app opens the trip from bookingId. */
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[.+\]$/.test(token);

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Sends push notifications through Expo's push service, which forwards to FCM (Android) and APNs (iOS).
 * Push is off in tests and whenever PUSH_ENABLED is false, so nothing leaves the machine.
 */
export class NotificationService {
  /** forceEnabled lets tests exercise sending with a stubbed fetch. */
  constructor(private readonly forceEnabled = false) {}

  private get enabled(): boolean {
    return this.forceEnabled || (env.PUSH_ENABLED === 'true' && env.NODE_ENV !== 'test');
  }

  public async sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;
    try {
      const users = await UserModel.find({ _id: { $in: userIds }, pushToken: { $exists: true, $ne: '' } })
        .select('_id pushToken')
        .lean();
      const targets = users.filter((u) => u.pushToken && isExpoToken(u.pushToken));
      if (targets.length === 0) return;

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(
          targets.map((u) => ({
            to: u.pushToken,
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
            sound: 'default',
            priority: 'high',
            channelId: 'trips',
          })),
        ),
      });
      if (!response.ok) {
        console.error(`[Push] Expo push failed with ${response.status}`);
        return;
      }

      // Tokens from uninstalled apps are reported once; forget them so we stop sending.
      const { data: tickets } = (await response.json()) as { data?: ExpoTicket[] };
      const stale = (tickets ?? [])
        .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? targets[i]?._id : undefined))
        .filter(Boolean);
      if (stale.length > 0) await UserModel.updateMany({ _id: { $in: stale } }, { $unset: { pushToken: 1 } });
    } catch (error) {
      console.error('[Push] failed:', errorMessage(error));
    }
  }

  public sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
    return this.sendToUsers([userId], payload);
  }

  /** Tells the rider about a change to their trip. */
  public notifyRider(customerId: string, bookingId: string, status: BookingStatus, detail: { driverName?: string; reason?: string; fare?: number }) {
    const driver = detail.driverName || 'Your driver';
    const messages: Partial<Record<BookingStatus, [string, string]>> = {
      DRIVER_ACCEPTED: ['Driver on the way', `${driver} accepted your ride.`],
      DRIVER_ARRIVING: ['Driver has arrived', `${driver} is at the pickup point.`],
      TRIP_STARTED: ['Trip started', 'Have a safe journey.'],
      TRIP_COMPLETED: ['Trip completed', detail.fare ? `Fare: ₹${detail.fare}. Tap to rate your driver.` : 'Tap to rate your driver.'],
      CANCELLED: ['Ride cancelled', detail.reason || 'Your ride was cancelled.'],
    };
    const message = messages[status];
    if (!message) return Promise.resolve();
    return this.sendToUser(customerId, { title: message[0], body: message[1], data: { bookingId, status } });
  }

  /** Tells a driver the rider cancelled their trip. */
  public notifyDriverCancelled(driverUserId: string, bookingId: string) {
    return this.sendToUser(driverUserId, {
      title: 'Trip cancelled',
      body: 'The rider cancelled this trip. You are back online.',
      data: { bookingId, status: 'CANCELLED' },
    });
  }

  /** Offers a ride to drivers whose app may be in the background. */
  public notifyRideOffer(driverUserIds: string[], bookingId: string, fare: number, pickupAddress: string) {
    return this.sendToUsers(driverUserIds, {
      title: `New ride request • ₹${fare}`,
      body: `Pickup: ${pickupAddress}`,
      data: { bookingId, type: 'RIDE_OFFER' },
    });
  }
}

export const notificationService = new NotificationService();
