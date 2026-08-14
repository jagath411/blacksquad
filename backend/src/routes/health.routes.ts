import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';

const router = Router();

// GET /health or /api/health
router.get('/', getHealth);

export default router;
