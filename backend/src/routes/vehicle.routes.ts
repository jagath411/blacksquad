import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { VehicleModel } from '../models/Vehicle';

const router = Router();
const vehicleSchema = z.object({
  registrationNumber: z.string().min(2).max(20),
  vehicleType: z.string().min(2).max(60),
  model: z.string().max(80).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
});
router.get('/', requireAuth, requireRole('OWNER'), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      vehicles: await VehicleModel.find().populate('driverId').sort({ createdAt: -1 }).lean(),
    });
  } catch (error) {
    next(error);
  }
});
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const vehicle = await VehicleModel.create(vehicleSchema.parse(req.body));
    res.status(201).json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
});
router.patch('/:vehicleId', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const vehicle = await VehicleModel.findByIdAndUpdate(
      req.params.vehicleId,
      { $set: vehicleSchema.partial().parse(req.body) },
      { new: true, runValidators: true },
    ).lean();
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found' });
      return;
    }
    res.json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
});
export default router;
