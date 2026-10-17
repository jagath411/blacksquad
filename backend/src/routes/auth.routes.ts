import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { UserModel, type UserDocument } from '../models/User';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { DriverLocationModel } from '../models/DriverLocation';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import type { AuthenticatedRequest } from '../types/auth';
import { smsService } from '../services/sms.service';
import {
  issueTokens,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  toAuthUser,
} from '../services/auth.service';
import { createOtpChallenge, shouldExposeDevOtp, verifyOtpChallenge } from '../services/otp.service';
import { logger } from '../utils/logger';

const router = Router();

// Per-IP limits on the endpoints people could brute-force or use to send SMS.
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const signupLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const otpSendLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const otpVerifyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });

const emailPassword = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const googleClientIds = [
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_WEB_CLIENT_ID,
  env.GOOGLE_ANDROID_CLIENT_ID,
  env.GOOGLE_IOS_CLIENT_ID,
].filter((id): id is string => Boolean(id && id.length > 5));
const googleClient = new OAuth2Client();

const publicUser = (user: UserDocument) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  savedPlaces: (user.savedPlaces ?? []).map((p) => ({
    label: p.label,
    address: p.address,
    coordinates: p.location.coordinates,
  })),
  emergencyContact: user.emergencyContact?.phoneNumber ? user.emergencyContact : null,
});

async function sessionResponse(user: UserDocument) {
  const tokens = await issueTokens(toAuthUser(user));
  return { success: true, user: publicUser(user), ...tokens };
}

/** Every public sign-up is a customer. Drivers are invited by an owner; owners are created by an admin. */
router.post('/register', signupLimiter, async (req, res, next) => {
  try {
    const data = emailPassword.extend({ name: z.string().min(2).max(120) }).parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: 'Email is already registered' });
      return;
    }
    const user = await UserModel.create({
      name: data.name,
      email,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: 'CUSTOMER',
    });
    res.status(201).json(await sessionResponse(user));
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const data = emailPassword.parse(req.body);
    const user = await UserModel.findOne({
      email: data.email.toLowerCase(),
      isActive: true,
    }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    res.json(await sessionResponse(user));
  } catch (error) {
    next(error);
  }
});

router.post('/google', loginLimiter, async (req, res, next) => {
  try {
    const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
    if (googleClientIds.length === 0) {
      res.status(503).json({ success: false, message: 'Google sign-in is not configured' });
      return;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientIds });
      payload = ticket.getPayload();
    } catch {
      payload = undefined;
    }
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      res.status(401).json({ success: false, message: 'Google account token could not be verified' });
      return;
    }

    const email = payload.email.toLowerCase();
    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await UserModel.create({
        name: payload.name || email.split('@')[0],
        email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role: 'CUSTOMER',
      });
    }
    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is disabled' });
      return;
    }
    res.json(await sessionResponse(user));
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const { user, tokens } = await rotateRefreshToken(refreshToken);
    res.json({ success: true, user: publicUser(user), ...tokens });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const userId = await revokeRefreshToken(refreshToken);
    // A signed-out phone must stop receiving this account's notifications.
    if (userId) await UserModel.updateOne({ _id: userId }, { $unset: { pushToken: 1 } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await UserModel.findOne({ _id: req.user!.id, isActive: true });
    if (!user) {
      res.status(401).json({ success: false, message: 'Account is not active' });
      return;
    }
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

const profileUpdate = z.object({
  name: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().min(8).max(20).optional(),
  // Someone to call or share a trip with; null removes it.
  emergencyContact: z
    .object({ name: z.string().max(120).optional(), phoneNumber: z.string().min(8).max(20) })
    .nullable()
    .optional(),
  savedPlaces: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        address: z.string().trim().min(2).max(300),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
      }),
    )
    .max(10)
    .optional(),
});

router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = profileUpdate.parse(req.body);
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (data.name) set.name = data.name;
    if (data.phoneNumber) {
      const phoneNumber = normalizePhoneNumber(data.phoneNumber);
      const taken = await UserModel.exists({ phoneNumber, _id: { $ne: req.user!.id } });
      if (taken) {
        res.status(409).json({ success: false, message: 'That phone number belongs to another account' });
        return;
      }
      set.phoneNumber = phoneNumber;
    }
    if (data.savedPlaces) {
      set.savedPlaces = data.savedPlaces.map((p) => ({
        label: p.label,
        address: p.address,
        location: { type: 'Point', coordinates: p.coordinates },
      }));
    }
    if (data.emergencyContact) {
      set.emergencyContact = {
        name: data.emergencyContact.name,
        phoneNumber: normalizePhoneNumber(data.emergencyContact.phoneNumber),
      };
    } else if (data.emergencyContact === null) {
      unset.emergencyContact = 1;
    }

    const user = await UserModel.findByIdAndUpdate(
      req.user!.id,
      { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * Deletes the signed-in account (required by Google Play and the App Store).
 * Personal details are removed; trip records stay, unlinked from the person, for accounting.
 */
router.delete('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user || !user.isActive) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }
    if (user.role === 'OWNER') {
      res.status(409).json({
        success: false,
        message: 'Fleet owner accounts are closed by BlackSquad support so drivers and payouts are handed over safely.',
      });
      return;
    }

    const driver = user.role === 'DRIVER' ? await DriverModel.findOne({ userId: user._id }).select('_id').lean() : null;
    const activeTrip = await BookingModel.exists({
      status: { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
      ...(driver ? { driverId: driver._id } : { customerId: user._id }),
    });
    if (activeTrip) {
      res.status(409).json({ success: false, message: 'Finish or cancel your current trip before deleting your account.' });
      return;
    }

    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          name: 'Deleted user',
          email: `deleted_${user.id}@blacksquad.internal`,
          isActive: false,
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
          savedPlaces: [],
        },
        $unset: { phoneNumber: 1, pushToken: 1, resetToken: 1, resetTokenExpiry: 1, emergencyContact: 1 },
      },
    );
    if (driver) {
      await DriverModel.updateOne(
        { _id: driver._id },
        { $set: { availabilityStatus: 'OFFLINE' }, $unset: { bankDetails: 1, licenseNumber: 1, currentLocation: 1 } },
      );
      await DriverLocationModel.deleteMany({ driverId: driver._id });
    }
    await revokeAllSessions(user.id);
    res.json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
});

router.post('/push-token', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { pushToken } = z.object({ pushToken: z.string().min(1).max(300) }).parse(req.body);
    await UserModel.findByIdAndUpdate(req.user!.id, { $set: { pushToken } });
    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── Forgot / reset password ──────────────────────────────────────────────────
router.post('/forgot-password', otpSendLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const genericReply = { success: true, message: 'If that email is registered, a reset link has been sent.' };

    const user = await UserModel.findOne({ email: email.toLowerCase(), isActive: true }).select(
      '+resetToken +resetTokenExpiry',
    );
    if (!user) {
      res.json(genericReply);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetLink = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // No email provider is wired up yet, so the link is only available in development.
    if (env.NODE_ENV === 'development') {
      logger.info(`🔐 Password reset link for ${user.email}: ${resetLink}`);
      res.json({ ...genericReply, devResetToken: rawToken, devResetLink: resetLink });
      return;
    }
    res.json(genericReply);
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const { email, token, newPassword } = z
      .object({
        email: z.string().email(),
        token: z.string().min(10),
        newPassword: z.string().min(8).max(128),
      })
      .parse(req.body);

    const user = await UserModel.findOne({
      email: email.toLowerCase(),
      resetToken: crypto.createHash('sha256').update(token).digest('hex'),
      resetTokenExpiry: { $gt: new Date() },
      isActive: true,
    }).select('+resetToken +resetTokenExpiry +passwordHash');

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.',
      });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    await revokeAllSessions(user.id);

    res.json({ success: true, message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    next(error);
  }
});

export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.trim().startsWith('+')) return `+${digits}`;
  return `+91${digits.slice(-10)}`;
}

/** Older records stored numbers in several formats; match any of them. */
export function phoneNumberVariants(normalized: string): string[] {
  const raw10 = normalized.replace(/^\+91/, '');
  return [normalized, raw10, `91${raw10}`, `0${raw10}`];
}

const phoneSchema = z.object({ phoneNumber: z.string().min(8).max(20) });

// ─── Phone OTP ────────────────────────────────────────────────────────────────
router.post('/phone/send-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const phoneNumber = normalizePhoneNumber(phoneSchema.parse(req.body).phoneNumber);
    const code = await createOtpChallenge(phoneNumber, 'LOGIN');
    const sms = await smsService.sendOtpSms(phoneNumber, code);
    const exposeCode = shouldExposeDevOtp();

    if (!sms.isLiveGateway && !exposeCode) {
      res.status(503).json({ success: false, message: 'SMS delivery is not configured on the server.' });
      return;
    }

    res.json({
      success: true,
      message: `Verification code sent to ${phoneNumber}.`,
      phoneNumber,
      smsProvider: sms.provider,
      isLiveGateway: sms.isLiveGateway,
      ...(exposeCode
        ? { devOtp: code, smsPreview: `[BlackSquad SMS] Your verification code is ${code}. Valid for 10 minutes.` }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/phone/verify-otp', otpVerifyLimiter, async (req, res, next) => {
  try {
    const body = phoneSchema.extend({ otp: z.string().min(4).max(8) }).parse(req.body);
    const phoneNumber = normalizePhoneNumber(body.phoneNumber);
    await verifyOtpChallenge(phoneNumber, body.otp);

    let user = await UserModel.findOne({ phoneNumber: { $in: phoneNumberVariants(phoneNumber) } });
    if (user && !user.isActive) {
      res.status(403).json({ success: false, message: 'Account is disabled' });
      return;
    }
    if (!user) {
      user = await UserModel.create({
        name: `User ${phoneNumber.slice(-4)}`,
        email: `phone_${phoneNumber.replace(/\D/g, '')}@blacksquad.internal`,
        phoneNumber,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role: 'CUSTOMER',
      });
    } else if (user.phoneNumber !== phoneNumber) {
      user.phoneNumber = phoneNumber;
      await user.save();
    }

    res.json(await sessionResponse(user));
  } catch (error) {
    next(error);
  }
});

export default router;
