import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { BookingModel, type BookingStatus } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { notificationService } from '../services/notification.service';
import { locationState } from '../services/location.service';
import { io } from '../server';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();

const createBookingSchema = z.object({
  pickupAddress: z.string().min(2),
  dropAddress: z.string().min(2),
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
    try {
      const data = createBookingSchema.parse(req.body);
      const startOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const booking = await BookingModel.create({
        customerId: req.user!.id,
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
        status: { $in: ['ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
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

// 3. Driver Accept Booking
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

      const driver = await DriverModel.findOne({ userId: req.user!.id });
      if (!driver) {
        res.status(404).json({ success: false, message: 'Driver profile not found' });
        return;
      }

      const booking = await BookingModel.findById(bookingId);
      if (!booking) {
        res.status(404).json({ success: false, message: 'Booking not found' });
        return;
      }

      if (booking.status !== 'REQUESTED' && booking.status !== 'ASSIGNED') {
        res.status(409).json({ success: false, message: 'Booking is no longer available' });
        return;
      }

      // If driver has no vehicle assigned, assign or attach active vehicle
      if (!driver.vehicleId) {
        const defaultVehicle = await VehicleModel.findOne({ driverId: driver._id });
        if (defaultVehicle) {
          driver.vehicleId = defaultVehicle._id as Types.ObjectId;
        }
      }

      booking.driverId = driver._id as Types.ObjectId;
      if (driver.vehicleId) {
        booking.vehicleId = driver.vehicleId;
      }
      booking.status = 'DRIVER_ACCEPTED';
      await booking.save();

      driver.availabilityStatus = 'ON_TRIP';
      await driver.save();

      // Track active booking in location service
      locationState.setActiveBooking(req.user!.id, booking._id.toString());

      // Fetch populated booking
      const populatedBooking = await BookingModel.findById(booking._id)
        .populate('customerId', 'name email phoneNumber')
        .populate({
          path: 'driverId',
          populate: { path: 'userId', select: 'name email phoneNumber' },
        })
        .populate('vehicleId')
        .lean();

      // Emit real-time status change to booking room and customer room
      io?.to(`booking:${booking._id}`).emit('booking:status:change', {
        bookingId: booking._id.toString(),
        status: 'DRIVER_ACCEPTED',
        booking: populatedBooking,
      });

      io?.to(`customer:${booking.customerId}`).emit('booking:status:change', {
        bookingId: booking._id.toString(),
        status: 'DRIVER_ACCEPTED',
        booking: populatedBooking,
      });

      void notificationService.notifyTripMilestone(
        booking.customerId.toString(),
        req.user?.name || 'Driver',
        'DRIVER_ACCEPTED',
      );

      res.json({ success: true, booking: populatedBooking });
    } catch (error) {
      next(error);
    }
  },
);

// 4. Update Booking Status (State Machine)
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    const statusSchema = z.object({
      status: z.enum(['DRIVER_ARRIVING', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CANCELLED']),
      otp: z.string().optional(),
      cancellationReason: z.string().optional(),
    });
    const { status, otp, cancellationReason } = statusSchema.parse(req.body);

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    // Security: Validate OTP when starting trip if driver is starting
    if (status === 'TRIP_STARTED' && booking.startOtp && otp) {
      if (otp.trim() !== booking.startOtp.trim()) {
        res.status(400).json({ success: false, message: 'Incorrect ride start PIN' });
        return;
      }
    }

    booking.status = status as BookingStatus;
    if (cancellationReason) {
      booking.cancellationReason = cancellationReason;
    }

    if (status === 'TRIP_STARTED') {
      booking.startedAt = new Date();
    }

    if (status === 'TRIP_COMPLETED') {
      booking.completedAt = new Date();
      if (booking.driverId) {
        const driverDoc = await DriverModel.findByIdAndUpdate(
          booking.driverId,
          { $set: { availabilityStatus: 'AVAILABLE' } },
          { new: true },
        );
        if (driverDoc) {
          locationState.setActiveBooking(driverDoc.userId.toString(), null);
        }
      }
    }

    if (status === 'CANCELLED') {
      booking.cancelledAt = new Date();
      if (booking.driverId) {
        const driverDoc = await DriverModel.findByIdAndUpdate(
          booking.driverId,
          { $set: { availabilityStatus: 'AVAILABLE' } },
          { new: true },
        );
        if (driverDoc) {
          locationState.setActiveBooking(driverDoc.userId.toString(), null);
        }
      }
    }

    await booking.save();

    const populatedBooking = await BookingModel.findById(booking._id)
      .populate('customerId', 'name email phoneNumber')
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .populate('vehicleId')
      .lean();

    // Broadcast status change to booking room, customer room, and driver room
    io?.to(`booking:${booking._id}`).emit('booking:status:change', {
      bookingId: booking._id.toString(),
      status,
      booking: populatedBooking,
    });

    io?.to(`customer:${booking.customerId}`).emit('booking:status:change', {
      bookingId: booking._id.toString(),
      status,
      booking: populatedBooking,
    });

    void notificationService.notifyTripMilestone(
      booking.customerId.toString(),
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
