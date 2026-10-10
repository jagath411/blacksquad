import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { locationState } from '../services/location.service';
import { ownerDriverUserIds } from '../services/fleet.service';
import { broadcastDriverLocation } from '../sockets';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.number().int().positive(),
});

router.post(
  '/',
  requireAuth,
  requireRole('DRIVER'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = locationSchema.parse(req.body);
      const result = await locationState.update({ ...parsed, driverId: req.user!.id });
      broadcastDriverLocation(req.user!.id, result);
      if (!result.accepted) {
        res.status(result.reason === 'driver_not_found' ? 409 : 202).json({
          success: false,
          accepted: false,
          message:
            result.reason === 'driver_not_found'
              ? 'Driver profile is not provisioned'
              : 'Stale location ignored',
        });
        return;
      }
      res.status(202).json({ success: true, accepted: true, location: result.location });
    } catch (error) {
      next(error);
    }
  },
);

// Owners see only the drivers in their own fleet.
router.get('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const fleet = await ownerDriverUserIds(req.user!.id);
    res.json({ success: true, locations: locationState.all().filter((l) => fleet.has(l.driverId)) });
  } catch (error) {
    next(error);
  }
});

router.get('/:driverId', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const driverId = req.params.driverId;
    const fleet = await ownerDriverUserIds(req.user!.id);
    if (!driverId || !fleet.has(driverId)) {
      res.status(404).json({ success: false, message: 'Driver not found in your fleet' });
      return;
    }
    res.json({ success: true, location: locationState.get(driverId) ?? null });
  } catch (error) {
    next(error);
  }
});

export default router;
