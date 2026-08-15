import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { locationState } from '../services/location.service';
import type { AuthenticatedRequest } from '../types/auth';

const bankDetailsSchema = z.object({
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
}).optional();

const profileSchema = z.object({
  licenseNumber: z.string().min(3).max(80).optional(),
  availabilityStatus: z.enum(['OFFLINE', 'AVAILABLE', 'ON_TRIP']).optional(),
  bankDetails: bankDetailsSchema,
});

const router = Router();

router.get('/me', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
  try { const driver = await DriverModel.findOne({ userId: req.user!.id }).populate('vehicleId').lean(); res.json({ success: true, driver }); } catch (error) { next(error); }
});

router.patch('/me', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
  try { const changes = profileSchema.parse(req.body); const driver = await DriverModel.findOneAndUpdate({ userId: req.user!.id }, { $set: changes }, { new: true, runValidators: true }).lean(); if (!driver) { res.status(404).json({ success: false, message: 'Driver profile not found' }); return; } res.json({ success: true, driver }); } catch (error) { next(error); }
});

router.get('/', requireAuth, requireRole('OWNER'), async (_req, res, next) => {
  try { const drivers = await DriverModel.find().populate('userId', 'name email').populate('vehicleId').sort({ updatedAt: -1 }).lean(); res.json({ success: true, drivers: drivers.map((driver) => ({ ...driver, liveLocation: locationState.get(driver.userId.toString()) ?? null })) }); } catch (error) { next(error); }
});

router.patch('/:driverId/vehicle', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const driverId = req.params.driverId; const vehicleId = z.string().parse(req.body.vehicleId);
    if (!driverId || !Types.ObjectId.isValid(driverId) || !Types.ObjectId.isValid(vehicleId)) { res.status(400).json({ success: false, message: 'Invalid driver or vehicle id' }); return; }
    const [driver, vehicle] = await Promise.all([DriverModel.findById(driverId), VehicleModel.findById(vehicleId)]);
    if (!driver || !vehicle) { res.status(404).json({ success: false, message: 'Driver or vehicle not found' }); return; }
    if (vehicle.driverId && vehicle.driverId.toString() !== driver.id) { res.status(409).json({ success: false, message: 'Vehicle is already assigned' }); return; }
    await VehicleModel.updateMany({ driverId: driver._id }, { $unset: { driverId: 1 } });
    vehicle.driverId = driver._id; await vehicle.save(); driver.vehicleId = vehicle._id; await driver.save();
    res.json({ success: true, driver, vehicle });
  } catch (error) { next(error); }
});
export default router;
