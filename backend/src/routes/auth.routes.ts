import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest, UserRole } from '../types/auth';

const router = Router();
const credentials = z.object({ name: z.string().min(2).max(120).optional(), email: z.string().email(), password: z.string().min(8).max(128), role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).optional() });
const tokenFor = (user: { id: string; email: string; role: UserRole }) => jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });

router.post('/register', async (req, res, next) => {
  try {
    const data = credentials.parse(req.body);
    if (!data.name) { res.status(400).json({ success: false, message: 'Name is required' }); return; }
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() }).lean();
    if (existing) { res.status(409).json({ success: false, message: 'Email is already registered' }); return; }
    const user = await UserModel.create({ name: data.name, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12), role: data.role ?? 'CUSTOMER' });
    const authUser = { id: user.id, email: user.email, role: user.role };
    res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken: tokenFor(authUser) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = credentials.pick({ email: true, password: true }).parse(req.body);
    const user = await UserModel.findOne({ email: data.email.toLowerCase(), isActive: true }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) { res.status(401).json({ success: false, message: 'Invalid email or password' }); return; }
    const authUser = { id: user.id, email: user.email, role: user.role };
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken: tokenFor(authUser) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => res.json({ success: true, user: req.user }));
export default router;
