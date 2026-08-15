import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { BookingModel, type BookingStatus } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { notificationService } from '../services/notification.service';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();

const createBookingSchema = z.object({
  pickupAddress: z.string().min(2),
  dropAddress: z.string().min(2),
  pickupCoordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  dropCoordinates: z.tuple([z.number(), z.number()]),   // [lng, lat]
  serviceTier: z.string().default('uberx'),
  fare: z.number().min(0),
  distanceKm: z.number().optional(),
});

// 1. Create Booking (Customer)
router.post('/', requireAuth, requireRole('CUSTOMER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);
    const booking = await BookingModel.create({
      customerId: req.user!.id,
      pickupAddress: data.pickupAddress,
      dropAddress: data.dropAddress,
      pickupLocation: { type: 'Point', coordinates: data.pickupCoordinates },
      dropLocation: { type: 'Point', coordinates: data.dropCoordinates },
      serviceTier: data.serviceTier,
      fare: data.fare,
      distanceKm: data.distanceKm,
      status: 'REQUESTED',
    });

    res.status(201).json({ success: true, booking });
  } catch (error) { next(error); }
});

// 2. Get Active Booking (Customer or Driver)
router.get('/active', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query: any = {};
    if (req.user!.role === 'CUSTOMER') {
      query = { customerId: req.user!.id, status: { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] } };
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).lean();
      if (!driver) { res.json({ success: true, booking: null }); return; }
      query = { driverId: driver._id, status: { $in: ['ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] } };
    } else {
      res.json({ success: true, booking: null });
      return;
    }

    const booking = await BookingModel.findOne(query)
      .populate('customerId', 'name email phoneNumber')
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'name email phoneNumber' } })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, booking });
  } catch (error) { next(error); }
});

// 3. Driver Accept Booking
router.post('/:id/accept', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
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

    booking.driverId = driver._id as Types.ObjectId;
    if (driver.vehicleId) booking.vehicleId = driver.vehicleId;
    booking.status = 'DRIVER_ACCEPTED';
    await booking.save();

    driver.availabilityStatus = 'ON_TRIP';
    await driver.save();

    void notificationService.notifyTripMilestone(booking.customerId.toString(), req.user?.name || 'Driver', 'DRIVER_ACCEPTED');

    res.json({ success: true, booking });
  } catch (error) { next(error); }
});

// 4. Update Booking Status (State Machine)
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const bookingId = req.params.id;
    const statusSchema = z.object({
      status: z.enum(['DRIVER_ARRIVING', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CANCELLED']),
    });
    const { status } = statusSchema.parse(req.body);

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    booking.status = status as BookingStatus;
    if (status === 'TRIP_STARTED') booking.startedAt = new Date();
    if (status === 'TRIP_COMPLETED') {
      booking.completedAt = new Date();
      if (booking.driverId) {
        await DriverModel.findByIdAndUpdate(booking.driverId, { $set: { availabilityStatus: 'AVAILABLE' } });
      }
    }
    if (status === 'CANCELLED') {
      booking.cancelledAt = new Date();
      if (booking.driverId) {
        await DriverModel.findByIdAndUpdate(booking.driverId, { $set: { availabilityStatus: 'AVAILABLE' } });
      }
    }

    await booking.save();
    void notificationService.notifyTripMilestone(booking.customerId.toString(), req.user?.name || 'Driver', status as any);

    res.json({ success: true, booking });
  } catch (error) { next(error); }
});

// 5. Booking History
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query: any = {};
    if (req.user!.role === 'CUSTOMER') {
      query = { customerId: req.user!.id };
    } else if (req.user!.role === 'DRIVER') {
      const driver = await DriverModel.findOne({ userId: req.user!.id }).lean();
      if (!driver) { res.json({ success: true, bookings: [] }); return; }
      query = { driverId: driver._id };
    }

    const bookings = await BookingModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, bookings });
  } catch (error) { next(error); }
});

export default router;
