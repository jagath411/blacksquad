import { UserModel } from '../models/User';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Send in-app and push notification payload to a targeted user
   */
  public async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId).select('pushToken email name').lean();
      if (!user) return false;

      // Log notification payload for server tracing
      // eslint-disable-next-line no-console
      console.log(
        `🔔 [NOTIFICATION SENT] User: ${user.name} (${user.email}) | ${payload.title}: ${payload.body}`,
      );

      if (user.pushToken) {
        // FCM / Expo push service handler stub
        // eslint-disable-next-line no-console
        console.log(`📱 [PUSH TOKEN DISPATCH] Token: ${user.pushToken.slice(0, 10)}...`);
      }
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to dispatch notification:', error);
      return false;
    }
  }

  /**
   * Send notification for trip state machine milestones
   */
  public async notifyTripMilestone(
    customerId: string,
    driverName: string,
    status: 'DRIVER_ACCEPTED' | 'DRIVER_ARRIVING' | 'TRIP_STARTED' | 'TRIP_COMPLETED' | 'CANCELLED',
  ): Promise<void> {
    const titles: Record<string, string> = {
      DRIVER_ACCEPTED: 'Driver Confirmed!',
      DRIVER_ARRIVING: 'Driver Arriving Soon',
      TRIP_STARTED: 'Trip Started',
      TRIP_COMPLETED: 'Trip Completed!',
      CANCELLED: 'Trip Cancelled',
    };

    const bodies: Record<string, string> = {
      DRIVER_ACCEPTED: `${driverName} accepted your ride request and is assigned.`,
      DRIVER_ARRIVING: `${driverName} is arriving at your pickup location now.`,
      TRIP_STARTED: `Your trip with ${driverName} is now underway. Enjoy the ride!`,
      TRIP_COMPLETED: `You have arrived at your destination. Thank you for riding with BlackSquad!`,
      CANCELLED: `Your ride request has been cancelled.`,
    };

    await this.sendToUser(customerId, {
      title: titles[status] || 'Trip Update',
      body: bodies[status] || `Trip status updated to ${status}`,
      data: { status, driverName },
    });
  }
}

export const notificationService = new NotificationService();
