import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth';
import { VehicleModel } from '../models/Vehicle';
import { DriverModel } from '../models/Driver';

const router = Router();

const vehicleSchema = z.object({
  registrationNumber: z.string().min(2).max(20),
  vehicleType: z.string().min(2).max(60).default('SEDAN'),
  model: z.string().max(80).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'EV']).default('DIESEL'),
  capacity: z.number().int().min(1).max(100).default(4),
  odometerKm: z.number().min(0).optional(),
  insuranceExpiry: z.string().optional(),
  pucExpiry: z.string().optional(),
  driverId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).default('ACTIVE'),
});

// 1. Get All Fleet Vehicles (with populated Driver + User details)
router.get('/', requireAuth, requireRole('OWNER'), async (_req, res, next) => {
  try {
    const vehicles = await VehicleModel.find()
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
});

// 2. Create New Vehicle
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = vehicleSchema.parse(req.body);
    const reg = data.registrationNumber.trim().toUpperCase();

    const existing = await VehicleModel.findOne({ registrationNumber: reg });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Vehicle with registration '${reg}' is already registered in the fleet.`,
      });
      return;
    }

    const vehicle = await VehicleModel.create({
      registrationNumber: reg,
      vehicleType: data.vehicleType,
      model: data.model?.trim() || 'Fleet Vehicle',
      fuelType: data.fuelType,
      capacity: data.capacity,
      odometerKm: data.odometerKm || 0,
      insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
      pucExpiry: data.pucExpiry ? new Date(data.pucExpiry) : undefined,
      driverId: data.driverId ? new Types.ObjectId(data.driverId) : undefined,
      status: data.status,
    });

    // If driver is assigned during vehicle creation, link vehicle to driver
    if (data.driverId) {
      await DriverModel.findByIdAndUpdate(data.driverId, { vehicleId: vehicle._id });
    }

    const populated = await VehicleModel.findById(vehicle._id)
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .lean();

    res.status(201).json({ success: true, vehicle: populated });
  } catch (error) {
    next(error);
  }
});

// 3. Update Vehicle (Details or Driver Assignment)
router.patch('/:vehicleId', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const partialData = vehicleSchema.partial().parse(req.body);

    const updateObj: Record<string, any> = { ...partialData };
    if (partialData.registrationNumber) {
      updateObj.registrationNumber = partialData.registrationNumber.trim().toUpperCase();
    }
    if (partialData.insuranceExpiry) {
      updateObj.insuranceExpiry = new Date(partialData.insuranceExpiry);
    }
    if (partialData.pucExpiry) {
      updateObj.pucExpiry = new Date(partialData.pucExpiry);
    }
    if ('driverId' in partialData) {
      updateObj.driverId = partialData.driverId ? new Types.ObjectId(partialData.driverId) : null;
    }

    const existingVehicle = await VehicleModel.findById(vehicleId);
    if (!existingVehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found' });
      return;
    }

    const prevDriverId = existingVehicle.driverId?.toString();
    const newDriverId = partialData.driverId;

    const vehicle = await VehicleModel.findByIdAndUpdate(
      vehicleId,
      { $set: updateObj },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phoneNumber' },
      })
      .lean();

    // Re-link drivers if driver assignment changed
    if (prevDriverId && prevDriverId !== newDriverId) {
      await DriverModel.findByIdAndUpdate(prevDriverId, { $unset: { vehicleId: 1 } });
    }
    if (newDriverId && newDriverId !== prevDriverId) {
      await DriverModel.findByIdAndUpdate(newDriverId, { vehicleId: existingVehicle._id });
    }

    res.json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
});

// 4. Delete Vehicle
router.delete('/:vehicleId', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await VehicleModel.findById(vehicleId);
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found' });
      return;
    }

    if (vehicle.driverId) {
      await DriverModel.findByIdAndUpdate(vehicle.driverId, { $unset: { vehicleId: 1 } });
    }

    await VehicleModel.findByIdAndDelete(vehicleId);
    res.json({ success: true, message: 'Vehicle deleted from fleet successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
