import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest, UserRole } from '../types/auth';
import { DriverModel } from '../models/Driver';
import { OAuth2Client } from 'google-auth-library';
import { smsService } from '../services/sms.service';

const router = Router();
const credentials = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).optional(),
});
const tokenFor = (user: { id: string; email: string; role: UserRole }) =>
  jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID
    || env.GOOGLE_WEB_CLIENT_ID
    || env.GOOGLE_ANDROID_CLIENT_ID
    || env.GOOGLE_IOS_CLIENT_ID,
);

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

// ─── Forgot Password ───────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);

    const user = await UserModel.findOne({ email: email.toLowerCase(), isActive: true }).select('+resetToken +resetTokenExpiry');
    if (!user) {
      // Return 200 even if user not found (security: don't reveal account existence)
      res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
      return;
    }

    // Generate a cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetToken = hashedToken;
    user.resetTokenExpiry = expiry;
    await user.save();

    // Build reset link (deep link for mobile, web link for browser)
    const resetLink = `http://65.2.202.84:5000/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // Log to console (production would use nodemailer/SendGrid/etc.)
    // eslint-disable-next-line no-console
    console.log('\n🔐 PASSWORD RESET REQUEST');
    console.log(`   User: ${user.name} <${user.email}>`);
    console.log(`   Token: ${rawToken}`);
    console.log(`   Reset Link: ${resetLink}`);
    console.log(`   Expires: ${expiry.toISOString()}\n`);

    res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
      // In dev mode, expose token so frontend can test without SMTP
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: rawToken, devResetLink: resetLink } : {}),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Reset Password ────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      token: z.string().min(10),
      newPassword: z.string().min(8).max(128),
    });
    const { email, token, newPassword } = schema.parse(req.body);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await UserModel.findOne({
      email: email.toLowerCase(),
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: new Date() },
      isActive: true,
    }).select('+resetToken +resetTokenExpiry +passwordHash');

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token. Please request a new password reset.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    next(error);
  }
});

export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (raw.startsWith('+')) {
    return `+${digits}`;
  }
  return `+91${digits.slice(-10)}`;
}

// ─── Phone Number OTP: Send OTP ───────────────────────────────────────────────
router.post('/phone/send-otp', async (req, res, next) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().min(8).max(20),
      role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).optional(),
    });
    const { phoneNumber, role } = schema.parse(req.body);
    const cleanedPhone = normalizePhoneNumber(phoneNumber);
    const raw10 = cleanedPhone.replace(/^\+91/, '');

    // Generate 6-digit secure numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Find existing user by phone or create new placeholder user
    let user = await UserModel.findOne({
      $or: [
        { phoneNumber: cleanedPhone },
        { phoneNumber: raw10 },
        { phoneNumber: '+91' + raw10 },
        { phoneNumber: '91' + raw10 },
        { phoneNumber: '0' + raw10 },
      ],
      isActive: true,
    }).select('+phoneOtp +phoneOtpExpiry');

    if (!user) {
      // Auto-create user for frictionless onboarding
      const tempEmail = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@blacksquad.internal`;
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await UserModel.create({
        name: `User ${cleanedPhone.slice(-4)}`,
        email: tempEmail,
        phoneNumber: cleanedPhone,
        passwordHash: dummyPassword,
        role: role || 'CUSTOMER',
        phoneOtp: otp,
        phoneOtpExpiry: expiry,
      });

      if (user.role === 'DRIVER') {
        await DriverModel.create({ userId: user._id });
      }
    } else {
      user.phoneNumber = cleanedPhone;
      user.phoneOtp = otp;
      user.phoneOtpExpiry = expiry;
      if (role && user.role === 'CUSTOMER' && role === 'DRIVER') {
        user.role = 'DRIVER';
        const existingDriver = await DriverModel.findOne({ userId: user._id });
        if (!existingDriver) await DriverModel.create({ userId: user._id });
      }
      await user.save();
    }

    // Dispatch real SMS via configured SMS Gateway (Twilio / Fast2SMS / MSG91 / Webhook)
    const smsResult = await smsService.sendOtpSms(cleanedPhone, otp);

    res.json({
      success: true,
      message: smsResult.isLiveGateway
        ? `OTP code sent to ${cleanedPhone} via ${smsResult.provider} SMS network.`
        : `OTP code dispatched to ${cleanedPhone}. (Simulator mode: SMS key not configured in .env)`,
      phoneNumber: cleanedPhone,
      smsProvider: smsResult.provider,
      isLiveGateway: smsResult.isLiveGateway,
      // Provide OTP and preview if running under simulated gateway or dev mode so user is never blocked
      ...(!smsResult.isLiveGateway || env.SHOW_DEV_OTP === 'true'
        ? {
            devOtp: otp,
            smsPreview: `[BlackSquad SMS] Your verification code is ${otp}. Valid for 10 minutes.`,
          }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Phone Number OTP: Verify OTP & Login ─────────────────────────────────────
router.post('/phone/verify-otp', async (req, res, next) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().min(8).max(20),
      otp: z.string().min(4).max(8),
      role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']).optional(),
    });
    const { phoneNumber, otp, role } = schema.parse(req.body);
    const cleanedPhone = normalizePhoneNumber(phoneNumber);
    const raw10 = cleanedPhone.replace(/^\+91/, '');

    const user = await UserModel.findOne({
      $or: [
        { phoneNumber: cleanedPhone },
        { phoneNumber: raw10 },
        { phoneNumber: '+91' + raw10 },
        { phoneNumber: '91' + raw10 },
        { phoneNumber: '0' + raw10 },
      ],
      isActive: true,
    }).select('+phoneOtp +phoneOtpExpiry');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found with this phone number. Please request a new OTP.' });
      return;
    }

    if (!user.phoneOtp || user.phoneOtp !== otp.trim()) {
      res.status(401).json({ success: false, message: 'Invalid OTP. Please check the code and try again.' });
      return;
    }

    if (!user.phoneOtpExpiry || user.phoneOtpExpiry < new Date()) {
      res.status(401).json({ success: false, message: 'OTP has expired. Please request a new one.' });
      return;
    }

    // Clear used OTP
    user.phoneOtp = undefined;
    user.phoneOtpExpiry = undefined;
    user.phoneNumber = cleanedPhone;
    if (role && user.role !== role && user.role === 'CUSTOMER') {
      user.role = role;
      if (role === 'DRIVER') {
        const existingDriver = await DriverModel.findOne({ userId: user._id });
        if (!existingDriver) await DriverModel.create({ userId: user._id });
      }
    }
    await user.save();

    const authUser = { id: user.id, email: user.email, role: user.role };
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      accessToken: tokenFor(authUser),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
