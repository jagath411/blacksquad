import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { locationState } from '../services/location.service';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const locationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), speed: z.number().min(0).optional(), heading: z.number().min(0).max(360).optional(), accuracy: z.number().min(0).optional(), timestamp: z.number().int().positive() });

router.post('/', requireAuth, requireRole('DRIVER'), (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = locationSchema.parse(req.body);
    const result = locationState.update({ ...parsed, driverId: req.user!.id });
    if (!result.accepted) { res.status(202).json({ success: true, accepted: false, message: 'Stale location ignored' }); return; }
    res.status(202).json({ success: true, accepted: true, location: result.location });
  } catch (error) { next(error); }
});

router.get('/', requireAuth, requireRole('OWNER'), (_req, res) => res.json({ success: true, locations: locationState.all() }));
router.get('/:driverId', requireAuth, requireRole('OWNER'), (req, res) => {
  const driverId = req.params.driverId;
  if (!driverId) { res.status(400).json({ success: false, message: 'driverId is required' }); return; }
  res.json({ success: true, location: locationState.get(driverId) ?? null });
});
export default router;
