import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth';
import { VehicleModel } from '../models/Vehicle';
import { DriverModel } from '../models/Driver';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
router.use(requireAuth, requireRole('OWNER'));

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

const populateDriver = {
  path: 'driverId',
  select: 'userId licenseNumber availabilityStatus',
  populate: { path: 'userId', select: 'name email phoneNumber' },
};

/** A driver can be linked to a vehicle only if both are in the same owner's fleet. */
async function ownsDriver(ownerId: string, driverId: string): Promise<boolean> {
  return Types.ObjectId.isValid(driverId) && Boolean(await DriverModel.exists({ _id: driverId, ownerId }));
}

// 1. The owner's vehicles
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const vehicles = await VehicleModel.find({ ownerId: req.user!.id })
      .populate(populateDriver)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, vehicles });
  } catch (error) {
    next(error);
  }
});

// 2. Add a vehicle
router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const ownerId = req.user!.id;
    const data = vehicleSchema.parse(req.body);
    const reg = data.registrationNumber.trim().toUpperCase();

    if (await VehicleModel.exists({ registrationNumber: reg })) {
      res.status(409).json({ success: false, message: `Vehicle '${reg}' is already registered.` });
      return;
    }
    if (data.driverId && !(await ownsDriver(ownerId, data.driverId))) {
      res.status(404).json({ success: false, message: 'Driver not found in your fleet' });
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
      ownerId,
      status: data.status,
    });

    if (data.driverId) {
      await DriverModel.updateOne({ _id: data.driverId, ownerId }, { vehicleId: vehicle._id });
    }

    const populated = await VehicleModel.findById(vehicle._id).populate(populateDriver).lean();
    res.status(201).json({ success: true, vehicle: populated });
  } catch (error) {
    next(error);
  }
});

// 3. Update a vehicle or its driver
router.patch('/:vehicleId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const ownerId = req.user!.id;
    const { vehicleId } = req.params;
    if (!vehicleId || !Types.ObjectId.isValid(vehicleId)) {
      res.status(400).json({ success: false, message: 'Invalid vehicle id' });
      return;
    }
    const partialData = vehicleSchema.partial().parse(req.body);

    const existingVehicle = await VehicleModel.findOne({ _id: vehicleId, ownerId });
    if (!existingVehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found' });
      return;
    }
    if (partialData.driverId && !(await ownsDriver(ownerId, partialData.driverId))) {
      res.status(404).json({ success: false, message: 'Driver not found in your fleet' });
      return;
    }

    const updateObj: Record<string, unknown> = { ...partialData };
    if (partialData.registrationNumber) {
      updateObj.registrationNumber = partialData.registrationNumber.trim().toUpperCase();
    }
    if (partialData.insuranceExpiry) updateObj.insuranceExpiry = new Date(partialData.insuranceExpiry);
    if (partialData.pucExpiry) updateObj.pucExpiry = new Date(partialData.pucExpiry);
    if ('driverId' in partialData) {
      updateObj.driverId = partialData.driverId ? new Types.ObjectId(partialData.driverId) : null;
    }

    const prevDriverId = existingVehicle.driverId?.toString();
    const newDriverId = partialData.driverId;

    const vehicle = await VehicleModel.findOneAndUpdate(
      { _id: vehicleId, ownerId },
      { $set: updateObj },
      { new: true, runValidators: true },
    )
      .populate(populateDriver)
      .lean();

    if ('driverId' in partialData && prevDriverId && prevDriverId !== newDriverId) {
      await DriverModel.updateOne({ _id: prevDriverId, ownerId }, { $unset: { vehicleId: 1 } });
    }
    if (newDriverId && newDriverId !== prevDriverId) {
      await DriverModel.updateOne({ _id: newDriverId, ownerId }, { vehicleId: existingVehicle._id });
    }

    res.json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
});

// 4. Delete a vehicle
router.delete('/:vehicleId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const ownerId = req.user!.id;
    const { vehicleId } = req.params;
    if (!vehicleId || !Types.ObjectId.isValid(vehicleId)) {
      res.status(400).json({ success: false, message: 'Invalid vehicle id' });
      return;
    }
    const vehicle = await VehicleModel.findOneAndDelete({ _id: vehicleId, ownerId });
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found' });
      return;
    }
    if (vehicle.driverId) {
      await DriverModel.updateOne({ _id: vehicle.driverId, ownerId }, { $unset: { vehicleId: 1 } });
    }
    res.json({ success: true, message: 'Vehicle deleted from fleet' });
  } catch (error) {
    next(error);
  }
});

export default router;
