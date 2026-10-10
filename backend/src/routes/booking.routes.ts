import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { BookingModel, type BookingStatus } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { notificationService } from '../services/notification.service';
import { locationState } from '../services/location.service';
import { FARE_TIERS, findTier, quoteFare } from '../services/pricing.service';
import { findBookingForView, withoutStartPin } from '../services/booking.view';
import { ownerDriverIds } from '../services/fleet.service';
import { offerRide, REQUEST_TIMEOUT_MS } from '../services/dispatch.service';
import { AVAILABLE_DRIVERS_ROOM, bookingRoom, customerRoom, getIO } from '../sockets';
import type { AuthenticatedRequest } from '../types/auth';
import { safeEqual } from '../utils/crypto';
import crypto from 'crypto';

const router = Router();

const customerBookingLocks = new Map<string, Promise<unknown>>();

const ACTIVE_STATUSES: BookingStatus[] = [
  'REQUESTED',
  'ASSIGNED',
  'DRIVER_ACCEPTED',
  'DRIVER_ARRIVING',
  'TRIP_STARTED',
];

// [longitude, latitude]
const coordinates = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const tripSchema = z.object({
  pickupCoordinates: coordinates,
  dropCoordinates: coordinates,
  serviceTier: z.string().min(1).max(60).default('uberx'),
});

const createBookingSchema = tripSchema.extend({
  pickupAddress: z.string().min(2).max(300),
  dropAddress: z.string().min(2).max(300),
});

const objectId = (value: string | undefined): value is string => Boolean(value && Types.ObjectId.isValid(value));

/** Sends a status change to everyone watching; only the customer's copy carries the trip PIN. */
function broadcastStatus(
  booking: { _id: Types.ObjectId; customerId: Types.ObjectId | { _id: Types.ObjectId } },
  status: BookingStatus,
  view: object | null,
): void {
  const io = getIO();
  if (!io) return;
  const bookingId = booking._id.toString();
  const customerId =
    'toHexString' in booking.customerId ? booking.customerId.toString() : booking.customerId._id.toString();

  io.to(bookingRoom(bookingId))
    .except(customerRoom(customerId))
    .emit('booking:status:change', { bookingId, status, booking: withoutStartPin(view) });
  io.to(customerRoom(customerId)).emit('booking:status:change', { bookingId, status, booking: view });
}

router.get('/tiers', requireAuth, (_req, res) => {
  res.json({ success: true, tiers: FARE_TIERS });
});

// Prices for every tier, so the app can show them before the customer books.
router.post('/quote', requireAuth, (req, res, next) => {
  try {
    const { pickupCoordinates, dropCoordinates } = tripSchema.omit({ serviceTier: true }).parse(req.body);
    const quotes = FARE_TIERS.map((tier) => ({
      tier: tier.id,
      name: tier.name,
      ...quoteFare(tier, pickupCoordinates, dropCoordinates),
    }));
    res.json({ success: true, quotes, requestTimeoutSeconds: REQUEST_TIMEOUT_MS / 1000 });
  } catch (error) {
    next(error);
  }
});

// 1. Create booking (customer). The server sets the fare; any fare sent by the app is ignored.
router.post('/', requireAuth, requireRole('CUSTOMER'), async (req: AuthenticatedRequest, res, next) => {
  const customerId = req.user!.id;
  const previousLock = customerBookingLocks.get(customerId) ?? Promise.resolve();
  let resolveLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  const chain = previousLock.then(() => currentLock);
  customerBookingLocks.set(customerId, chain);
  await previousLock;

  try {
    const data = createBookingSchema.parse(req.body);
    const tier = findTier(data.serviceTier);
    if (!tier) {
      res.status(400).json({ success: false, message: 'Unknown service tier' });
      return;
    }

    const activeExisting = await BookingModel.findOne({ customerId, status: { $in: ACTIVE_STATUSES } }).lean();
    if (activeExisting) {
      res.status(409).json({
        success: false,
        message: 'You already have an active ride request in progress.',
        booking: activeExisting,
      });
      return;
    }

    const { fare, distanceKm } = quoteFare(tier, data.pickupCoordinates, data.dropCoordinates);
    const booking = await BookingModel.create({
      customerId,
      pickupAddress: data.pickupAddress,
      dropAddress: data.dropAddress,
      pickupLocation: { type: 'Point', coordinates: data.pickupCoordinates },
      dropLocation: { type: 'Point', coordinates: data.dropCoordinates },
      serviceTier: tier.id,
      fare,
      distanceKm,
      startOtp: crypto.randomInt(1000, 10000).toString(),
      status: 'REQUESTED',
    });

    const offeredTo = await offerRide(
      {
        _id: booking._id.toString(),
        pickupAddress: booking.pickupAddress,
        dropAddress: booking.dropAddress,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        serviceTier: booking.serviceTier,
        fare: booking.fare,
        distanceKm: booking.distanceKm,
        createdAt: booking.createdAt,
      },
      data.pickupCoordinates,
    );

    res.status(201).json({ success: true, booking, driversNotified: offeredTo });
  } catch (error) {
    next(error);
  } finally {
    resolveLock();
    if (customerBookingLocks.get(customerId) === chain) customerBookingLocks.delete(customerId);
  }
});

// 2. Active booking (customer or driver)
router.get('/active', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let booking = null;
    if (req.user!.role === 'CUSTOMER') {
      const found = await BookingModel.findOne({ customerId: req.user!.id, status: { $in: ACTIVE_STATUSES } })
        .sort({ createdAt: -1 })
        .select('_id')
        .lean();
      booking = found ? await findBookingForView(found._id) : null;
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).select('_id').lean();
      const found = driver
        ? await BookingModel.findOne({
            driverId: driver._id,
            status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
          })
            .sort({ createdAt: -1 })
            .select('_id')
            .lean()
        : null;
      booking = found ? withoutStartPin(await findBookingForView(found._id)) : null;
    }
    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

// A ride still waiting for a driver, for a driver opening its notification. No rider details.
router.get('/:id/offer', requireAuth, requireRole('DRIVER'), async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    if (!objectId(bookingId)) {
      res.status(400).json({ success: false, message: 'Invalid booking ID' });
      return;
    }
    const offer = await BookingModel.findOne({ _id: bookingId, status: 'REQUESTED' })
      .select('pickupAddress dropAddress pickupLocation dropLocation serviceTier fare distanceKm createdAt')
      .lean();
    res.json({ success: true, offer });
  } catch (error) {
    next(error);
  }
});

// 3. Driver accepts a booking (atomic; only one driver can win)
router.post('/:id/accept', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    if (!objectId(bookingId)) {
      res.status(400).json({ success: false, message: 'Invalid booking ID' });
      return;
    }

    // Only an online driver who is not already on a trip can accept.
    const driver = await DriverModel.findOneAndUpdate(
      { userId: req.user!.id, availabilityStatus: 'AVAILABLE' },
      { $set: { availabilityStatus: 'ON_TRIP' } },
      { new: true },
    );
    if (!driver) {
      res.status(409).json({ success: false, message: 'Go online to accept rides, or finish your current trip first.' });
      return;
    }

    if (!driver.vehicleId) {
      const defaultVehicle = await VehicleModel.findOne({ driverId: driver._id });
      if (defaultVehicle) {
        driver.vehicleId = defaultVehicle._id;
        await driver.save();
      }
    }

    const updatedBooking = await BookingModel.findOneAndUpdate(
      { _id: bookingId, status: { $in: ['REQUESTED', 'ASSIGNED'] } },
      {
        $set: {
          status: 'DRIVER_ACCEPTED',
          driverId: driver._id,
          ...(driver.vehicleId ? { vehicleId: driver.vehicleId } : {}),
        },
      },
      { new: true },
    );

    if (!updatedBooking) {
      await DriverModel.findByIdAndUpdate(driver._id, { $set: { availabilityStatus: 'AVAILABLE' } });
      res.status(409).json({ success: false, message: 'This ride is no longer available (accepted by another partner).' });
      return;
    }

    locationState.setActiveBooking(req.user!.id, updatedBooking._id.toString());
    getIO()?.to(AVAILABLE_DRIVERS_ROOM).emit('booking:request:taken', { bookingId: updatedBooking._id.toString() });

    const view = await findBookingForView(updatedBooking._id);
    broadcastStatus(updatedBooking, 'DRIVER_ACCEPTED', view);
    void notificationService.notifyRider(updatedBooking.customerId.toString(), updatedBooking._id.toString(), 'DRIVER_ACCEPTED', {
      driverName: req.user?.name,
    });

    res.json({ success: true, booking: withoutStartPin(view) });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  status: z.enum(['DRIVER_ARRIVING', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CANCELLED']),
  otp: z.string().max(10).optional(),
  cancellationReason: z.string().max(300).optional(),
});

/** Which statuses each role may move a booking into, and from which statuses. */
const TRANSITIONS: Record<'CUSTOMER' | 'DRIVER', Partial<Record<BookingStatus, BookingStatus[]>>> = {
  CUSTOMER: {
    CANCELLED: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING'],
  },
  DRIVER: {
    DRIVER_ARRIVING: ['DRIVER_ACCEPTED'],
    TRIP_STARTED: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'],
    TRIP_COMPLETED: ['TRIP_STARTED'],
    CANCELLED: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'],
  },
};

// 4. Update booking status. Only the booking's customer or its assigned driver can act on it.
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    if (!objectId(bookingId)) {
      res.status(400).json({ success: false, message: 'Invalid booking ID' });
      return;
    }
    const { status, otp, cancellationReason } = statusSchema.parse(req.body);
    const role = req.user!.role;
    if (role !== 'CUSTOMER' && role !== 'DRIVER') {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const condition: Record<string, unknown> = { _id: bookingId };
    if (role === 'CUSTOMER') {
      condition.customerId = req.user!.id;
    } else {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).select('_id').lean();
      if (!driver) {
        res.status(404).json({ success: false, message: 'Booking not found' });
        return;
      }
      condition.driverId = driver._id;
    }

    const existingBooking = await BookingModel.findOne(condition).lean();
    if (!existingBooking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const allowedFrom = TRANSITIONS[role][status];
    if (!allowedFrom) {
      res.status(403).json({ success: false, message: 'You cannot set this status' });
      return;
    }
    condition.status = { $in: allowedFrom };

    const updateFields: Record<string, unknown> = { status };
    if (status === 'TRIP_STARTED') {
      if (!otp || !existingBooking.startOtp || !safeEqual(otp.trim(), existingBooking.startOtp)) {
        res.status(400).json({ success: false, message: 'Incorrect ride start PIN' });
        return;
      }
      updateFields.startedAt = new Date();
    } else if (status === 'TRIP_COMPLETED') {
      updateFields.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      updateFields.cancelledAt = new Date();
      updateFields.cancellationReason = cancellationReason || `Cancelled by ${role.toLowerCase()}`;
    }

    const updatedBooking = await BookingModel.findOneAndUpdate(condition, { $set: updateFields }, { new: true });
    if (!updatedBooking) {
      res.status(409).json({
        success: false,
        message: `Cannot change ride status from '${existingBooking.status}' to '${status}'.`,
      });
      return;
    }

    // The trip's target changes from pickup to drop-off when it starts; refresh the live state.
    if (role === 'DRIVER' && status === 'TRIP_STARTED') {
      locationState.setActiveBooking(req.user!.id, updatedBooking._id.toString());
    }

    if ((status === 'TRIP_COMPLETED' || status === 'CANCELLED') && updatedBooking.driverId) {
      const driverDoc = await DriverModel.findOneAndUpdate(
        { _id: updatedBooking.driverId, availabilityStatus: 'ON_TRIP' },
        { $set: { availabilityStatus: 'AVAILABLE' } },
        { new: true },
      );
      if (driverDoc) locationState.setActiveBooking(driverDoc.userId.toString(), null);
    }

    const view = await findBookingForView(updatedBooking._id);
    broadcastStatus(updatedBooking, status, view);
    // The rider hears about every change the driver makes; the driver hears when the rider cancels.
    if (role === 'DRIVER') {
      void notificationService.notifyRider(updatedBooking.customerId.toString(), updatedBooking._id.toString(), status, {
        driverName: req.user?.name,
        reason: updatedBooking.cancellationReason,
        fare: updatedBooking.fare,
      });
    } else if (status === 'CANCELLED' && updatedBooking.driverId) {
      const driverDoc = await DriverModel.findById(updatedBooking.driverId).select('userId').lean();
      if (driverDoc) void notificationService.notifyDriverCancelled(driverDoc.userId.toString(), updatedBooking._id.toString());
    }

    res.json({ success: true, booking: role === 'CUSTOMER' ? view : withoutStartPin(view) });
  } catch (error) {
    next(error);
  }
});

// 5. Rate a completed trip, once per side.
router.post('/:id/rate', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    if (!objectId(bookingId)) {
      res.status(400).json({ success: false, message: 'Invalid booking ID' });
      return;
    }
    const { rating } = z.object({ rating: z.number().int().min(1).max(5) }).parse(req.body);

    let filter: Record<string, unknown>;
    let field: 'driverRating' | 'riderRating';
    if (req.user!.role === 'CUSTOMER') {
      filter = { _id: bookingId, customerId: req.user!.id };
      field = 'driverRating';
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).select('_id').lean();
      filter = { _id: bookingId, driverId: driver?._id ?? null };
      field = 'riderRating';
    } else {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const booking = await BookingModel.findOneAndUpdate(
      { ...filter, status: 'TRIP_COMPLETED', [field]: { $exists: false } },
      { $set: { [field]: rating } },
      { new: true },
    ).lean();
    if (!booking) {
      res.status(409).json({ success: false, message: 'This trip cannot be rated' });
      return;
    }
    res.json({ success: true, message: 'Rating saved successfully' });
  } catch (error) {
    next(error);
  }
});

// 6. Booking history
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query: Record<string, unknown>;
    if (req.user!.role === 'CUSTOMER') {
      query = { customerId: req.user!.id };
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).select('_id').lean();
      if (!driver) {
        res.json({ success: true, bookings: [] });
        return;
      }
      query = { driverId: driver._id };
    } else {
      query = { driverId: { $in: await ownerDriverIds(req.user!.id) } };
    }

    const bookings = await BookingModel.find(query)
      .select(req.user!.role === 'CUSTOMER' ? '' : '-startOtp')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
});

export default router;
