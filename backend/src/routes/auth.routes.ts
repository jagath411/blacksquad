import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest, UserRole } from '../types/auth';
import { DriverModel } from '../models/Driver';
import { OAuth2Client } from 'google-auth-library';

const router = Router();
const credentials = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).optional(),
});
const tokenFor = (user: { id: string; email: string; role: UserRole }) =>
  jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

router.post('/register', async (req, res, next) => {
  try {
    const data = credentials.parse(req.body);
    if (!data.name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: 'Email is already registered' });
      return;
    }
    const user = await UserModel.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 12),
      role: data.role ?? 'CUSTOMER',
    });
    if (user.role === 'DRIVER') await DriverModel.create({ userId: user._id });
    const authUser = { id: user.id, email: user.email, role: user.role };
    res.status(201).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: tokenFor(authUser),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = credentials.pick({ email: true, password: true }).parse(req.body);
    const user = await UserModel.findOne({
      email: data.email.toLowerCase(),
      isActive: true,
    }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    const authUser = { id: user.id, email: user.email, role: user.role };
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: tokenFor(authUser),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const data = z
      .object({
        idToken: z.string().min(10),
        role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).default('CUSTOMER'),
      })
      .parse(req.body);

    const audiences = [
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_WEB_CLIENT_ID,
      env.GOOGLE_ANDROID_CLIENT_ID,
      env.GOOGLE_IOS_CLIENT_ID,
    ].filter((id): id is string => Boolean(id && id.length > 5));

    let email: string | undefined;
    let name: string | undefined;
    let googleSub: string | undefined;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: data.idToken,
        audience: audiences.length > 0 ? audiences : undefined,
      });
      const payload = ticket.getPayload();
      if (payload?.email && payload.email_verified) {
        email = payload.email.toLowerCase();
        name = payload.name || payload.email.split('@')[0];
        googleSub = payload.sub;
      }
    } catch {
      // Fallback: Query Google userinfo endpoint if idToken is an access token
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.idToken}` },
      });
      if (userinfoRes.ok) {
        const info = (await userinfoRes.json()) as {
          email?: string;
          name?: string;
          sub?: string;
          email_verified?: boolean;
        };
        if (info.email) {
          email = info.email.toLowerCase();
          name = info.name || info.email.split('@')[0];
          googleSub = info.sub;
        }
      }
    }

    if (!email || !googleSub) {
      res
        .status(401)
        .json({ success: false, message: 'Google account token could not be verified' });
      return;
    }

    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await UserModel.create({
        name: name || email.split('@')[0],
        email,
        passwordHash: await bcrypt.hash(`google:${googleSub}:${env.JWT_SECRET}`, 12),
        role: data.role,
      });
    }

    if (user.role === 'DRIVER') {
      await DriverModel.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id } },
        { upsert: true },
      );
    }

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: tokenFor(authUser),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) =>
  res.json({ success: true, user: req.user }),
);

router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(2).max(120).optional(),
      phoneNumber: z.string().max(30).optional(),
    });
    const data = updateSchema.parse(req.body);
    const user = await UserModel.findByIdAndUpdate(
      req.user!.id,
      { $set: data },
      { new: true, runValidators: true },
    ).lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/push-token', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const tokenSchema = z.object({ pushToken: z.string().min(1) });
    const { pushToken } = tokenSchema.parse(req.body);
    await UserModel.findByIdAndUpdate(req.user!.id, { $set: { pushToken } });
    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
