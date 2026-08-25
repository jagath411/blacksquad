import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { notificationService } from '../services/notification.service';
import { locationState } from '../services/location.service';
import { io } from '../server';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();

const customerBookingLocks = new Map<string, Promise<unknown>>();

const createBookingSchema = z.object({
  pickupAddress: z.string().min(2).max(300),
  dropAddress: z.string().min(2).max(300),
  pickupCoordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  dropCoordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  serviceTier: z.string().default('uberx'),
  fare: z.number().min(0),
  distanceKm: z.number().optional(),
});

// 1. Create Booking (Customer)
router.post(
  '/',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: AuthenticatedRequest, res, next) => {
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

      // Concurrency Guard: Check if customer already has an active ride in progress
      const activeExisting = await BookingModel.findOne({
        customerId,
        status: { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
      }).lean();

      if (activeExisting) {
        res.status(409).json({
          success: false,
          message: 'You already have an active ride request in progress.',
          booking: activeExisting,
        });
        return;
      }

      const startOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const booking = await BookingModel.create({
        customerId,
        pickupAddress: data.pickupAddress,
        dropAddress: data.dropAddress,
        pickupLocation: { type: 'Point', coordinates: data.pickupCoordinates },
        dropLocation: { type: 'Point', coordinates: data.dropCoordinates },
        serviceTier: data.serviceTier,
        fare: data.fare,
        distanceKm: data.distanceKm,
        startOtp,
        status: 'REQUESTED',
      });

      // Broadcast new booking opportunity to available drivers
      io?.to('drivers:available').emit('booking:new:request', {
        _id: booking._id.toString(),
        pickupAddress: booking.pickupAddress,
        dropAddress: booking.dropAddress,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        serviceTier: booking.serviceTier,
        fare: booking.fare,
        distanceKm: booking.distanceKm,
        createdAt: booking.createdAt,
      });

      res.status(201).json({ success: true, booking });
    } catch (error) {
      next(error);
    } finally {
      resolveLock();
      if (customerBookingLocks.get(customerId) === chain) customerBookingLocks.delete(customerId);
    }
  },
);

// 2. Get Active Booking (Customer or Driver)
router.get('/active', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query: Record<string, unknown> = {};
    if (req.user!.role === 'CUSTOMER') {
      query = {
        customerId: req.user!.id,
        status: {
          $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'],
        },
      };
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).lean();
      if (!driver) {
        res.json({ success: true, booking: null });
        return;
      }
      query = {
        driverId: driver._id,
        status: {
          $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'],
        },
      };
    } else {
      res.json({ success: true, booking: null });
      return;
    }

    const booking = await BookingModel.findOne(query)
      .populate('customerId', 'name email phoneNumber')
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .populate('vehicleId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

// 3. Driver Accept Booking (Atomic Concurrency-Safe)
router.post(
  '/:id/accept',
  requireAuth,
  requireRole('DRIVER'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const bookingId = req.params.id;
      if (!bookingId || !Types.ObjectId.isValid(bookingId)) {
        res.status(400).json({ success: false, message: 'Invalid booking ID' });
        return;
      }

      // Step 1: Atomically acquire driver availability lock
      const driver = await DriverModel.findOneAndUpdate(
        { userId: req.user!.id, availabilityStatus: { $ne: 'ON_TRIP' } },
        { $set: { availabilityStatus: 'ON_TRIP' } },
        { new: true },
      );

      if (!driver) {
        res.status(409).json({ success: false, message: 'You are currently on an active trip or offline.' });
        return;
      }

      // If driver has no vehicle assigned, attach active vehicle
      if (!driver.vehicleId) {
        const defaultVehicle = await VehicleModel.findOne({ driverId: driver._id });
        if (defaultVehicle) {
          driver.vehicleId = defaultVehicle._id as Types.ObjectId;
          await driver.save();
        }
      }

      // Step 2: Atomically acquire booking lock (only if still REQUESTED or ASSIGNED)
      const updatedBooking = await BookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: ['REQUESTED', 'ASSIGNED'] },
        },
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
        // Rollback driver availability if another driver won the race
        await DriverModel.findByIdAndUpdate(driver._id, { $set: { availabilityStatus: 'AVAILABLE' } });
        res.status(409).json({ success: false, message: 'This ride is no longer available (accepted by another partner).' });
        return;
      }

      // Track active booking in location service
      locationState.setActiveBooking(req.user!.id, updatedBooking._id.toString());

      // Fetch populated booking
      const populatedBooking = await BookingModel.findById(updatedBooking._id)
        .populate('customerId', 'name email phoneNumber')
        .populate({
          path: 'driverId',
          populate: { path: 'userId', select: 'name email phoneNumber' },
        })
        .populate('vehicleId')
        .lean();

      // Emit real-time status change to booking room and customer room
      io?.to(`booking:${updatedBooking._id}`).emit('booking:status:change', {
        bookingId: updatedBooking._id.toString(),
        status: 'DRIVER_ACCEPTED',
        booking: populatedBooking,
      });

      io?.to(`customer:${updatedBooking.customerId}`).emit('booking:status:change', {
        bookingId: updatedBooking._id.toString(),
        status: 'DRIVER_ACCEPTED',
        booking: populatedBooking,
      });

      void notificationService.notifyTripMilestone(
        updatedBooking.customerId.toString(),
        req.user?.name || 'Driver',
        'DRIVER_ACCEPTED',
      );

      res.json({ success: true, booking: populatedBooking });
    } catch (error) {
      next(error);
    }
  },
);

// 4. Update Booking Status (Atomic State Machine)
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    const statusSchema = z.object({
      status: z.enum(['DRIVER_ARRIVING', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CANCELLED']),
      otp: z.string().optional(),
      cancellationReason: z.string().optional(),
    });
    const { status, otp, cancellationReason } = statusSchema.parse(req.body);

    const existingBooking = await BookingModel.findById(bookingId);
    if (!existingBooking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    // Atomic Condition & Updates based on Strict State Machine
    const condition: Record<string, any> = { _id: bookingId };
    const updateFields: Record<string, any> = { status };

    if (status === 'DRIVER_ARRIVING') {
      condition.status = 'DRIVER_ACCEPTED';
    } else if (status === 'TRIP_STARTED') {
      condition.status = { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'] };
      // Verify ride start PIN
      if (existingBooking.startOtp && otp) {
        if (otp.trim() !== existingBooking.startOtp.trim()) {
          res.status(400).json({ success: false, message: 'Incorrect ride start PIN' });
          return;
        }
      }
      updateFields.startedAt = new Date();
    } else if (status === 'TRIP_COMPLETED') {
      condition.status = 'TRIP_STARTED';
      updateFields.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      // Cannot cancel an already completed trip
      condition.status = { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING'] };
      updateFields.cancelledAt = new Date();
      if (cancellationReason) {
        updateFields.cancellationReason = cancellationReason;
      }
    }

    const updatedBooking = await BookingModel.findOneAndUpdate(
      condition,
      { $set: updateFields },
      { new: true },
    );

    if (!updatedBooking) {
      res.status(409).json({
        success: false,
        message: `Cannot transition ride status from '${existingBooking.status}' to '${status}'.`,
      });
      return;
    }

    // Free driver if trip ended
    if (status === 'TRIP_COMPLETED' || status === 'CANCELLED') {
      if (updatedBooking.driverId) {
        const driverDoc = await DriverModel.findByIdAndUpdate(
          updatedBooking.driverId,
          { $set: { availabilityStatus: 'AVAILABLE' } },
          { new: true },
        );
        if (driverDoc) {
          locationState.setActiveBooking(driverDoc.userId.toString(), null);
        }
      }
    }

    const populatedBooking = await BookingModel.findById(updatedBooking._id)
      .populate('customerId', 'name email phoneNumber')
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .populate('vehicleId')
      .lean();

    // Broadcast status change to booking room, customer room, and driver room
    io?.to(`booking:${updatedBooking._id}`).emit('booking:status:change', {
      bookingId: updatedBooking._id.toString(),
      status,
      booking: populatedBooking,
    });

    io?.to(`customer:${updatedBooking.customerId}`).emit('booking:status:change', {
      bookingId: updatedBooking._id.toString(),
      status,
      booking: populatedBooking,
    });

    void notificationService.notifyTripMilestone(
      updatedBooking.customerId.toString(),
      req.user?.name || 'Driver',
      status,
    );

    res.json({ success: true, booking: populatedBooking });
  } catch (error) {
    next(error);
  }
});

// 5. Rate Trip (Customer or Driver)
router.post('/:id/rate', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    const rateSchema = z.object({
      rating: z.number().min(1).max(5),
    });
    const { rating } = rateSchema.parse(req.body);

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (req.user!.role === 'CUSTOMER') {
      booking.driverRating = rating;
    } else {
      booking.riderRating = rating;
    }
    await booking.save();

    res.json({ success: true, message: 'Rating saved successfully', booking });
  } catch (error) {
    next(error);
  }
});

// 6. Booking History
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query: Record<string, unknown> = {};
    if (req.user!.role === 'CUSTOMER') {
      query = { customerId: req.user!.id };
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).lean();
      if (!driver) {
        res.json({ success: true, bookings: [] });
        return;
      }
      query = { driverId: driver._id };
    }

    const bookings = await BookingModel.find(query).sort({ createdAt: -1 }).limit(20).lean();

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
});

export default router;
