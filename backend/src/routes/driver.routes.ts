import { Router } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';
import { VehicleModel } from '../models/Vehicle';
import { locationState } from '../services/location.service';
import { smsService } from '../services/sms.service';
import type { AuthenticatedRequest } from '../types/auth';

const onboardDriverSchema = z.object({
  name: z.string().min(2).max(120),
  phoneNumber: z.string().min(8).max(20),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(3).max(80).optional(),
  vehicleRegistration: z.string().min(3).max(30).optional(),
  vehicleModel: z.string().optional(),
  vehicleType: z.enum(['SEDAN', 'SUV', 'VAN', 'TRUCK']).default('SEDAN'),
});

const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    branchName: z.string().optional(),
    upiId: z.string().optional(),
  })
  .optional();

const profileSchema = z.object({
  licenseNumber: z.string().min(3).max(80).optional(),
  availabilityStatus: z.enum(['OFFLINE', 'AVAILABLE', 'ON_TRIP']).optional(),
  bankDetails: bankDetailsSchema,
});

const router = Router();

router.get(
  '/me',
  requireAuth,
  requireRole('DRIVER'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const driver = await DriverModel.findOne({ userId: req.user!.id })
        .populate('vehicleId')
        .lean();
      res.json({ success: true, driver });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/me',
  requireAuth,
  requireRole('DRIVER'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const changes = profileSchema.parse(req.body);
      const driver = await DriverModel.findOneAndUpdate(
        { userId: req.user!.id },
        { $set: changes },
        { new: true, runValidators: true },
      ).lean();
      if (!driver) {
        res.status(404).json({ success: false, message: 'Driver profile not found' });
        return;
      }
      res.json({ success: true, driver });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/', requireAuth, requireRole('OWNER'), async (_req, res, next) => {
  try {
    const drivers = await DriverModel.find()
      .populate('userId', 'name email')
      .populate('vehicleId')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({
      success: true,
      drivers: drivers.map((driver) => ({
        ...driver,
        liveLocation: locationState.get(driver.userId.toString()) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:driverId/vehicle', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const driverId = req.params.driverId;
    const vehicleId = z.string().parse(req.body.vehicleId);
    if (!driverId || !Types.ObjectId.isValid(driverId) || !Types.ObjectId.isValid(vehicleId)) {
      res.status(400).json({ success: false, message: 'Invalid driver or vehicle id' });
      return;
    }
    const [driver, vehicle] = await Promise.all([
      DriverModel.findById(driverId),
      VehicleModel.findById(vehicleId),
    ]);
    if (!driver || !vehicle) {
      res.status(404).json({ success: false, message: 'Driver or vehicle not found' });
      return;
    }
    if (vehicle.driverId && vehicle.driverId.toString() !== driver.id) {
      res.status(409).json({ success: false, message: 'Vehicle is already assigned' });
      return;
    }
    await VehicleModel.updateMany({ driverId: driver._id }, { $unset: { driverId: 1 } });
    vehicle.driverId = driver._id;
    await vehicle.save();
    driver.vehicleId = vehicle._id;
    await driver.save();
    res.json({ success: true, driver, vehicle });
  } catch (error) {
    next(error);
  }
});

// ─── Owner: Onboard New Driver ────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = onboardDriverSchema.parse(req.body);
    const cleanedPhone = data.phoneNumber.replace(/[\s-]/g, '');

    // 1. Find or create user
    let user = await UserModel.findOne({
      $or: [
        { phoneNumber: cleanedPhone },
        { phoneNumber: cleanedPhone.replace(/^\+91/, '') },
        { phoneNumber: '+91' + cleanedPhone.replace(/^\+91/, '') },
        ...(data.email ? [{ email: data.email.toLowerCase() }] : []),
      ],
    });

    if (!user) {
      const email = data.email
        ? data.email.toLowerCase()
        : `driver_${cleanedPhone.replace(/\+/g, '')}@blacksquad.internal`;
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await UserModel.create({
        name: data.name.trim(),
        email,
        phoneNumber: cleanedPhone,
        passwordHash: dummyPassword,
        role: 'DRIVER',
        isActive: true,
      });
    } else {
      user.name = data.name.trim();
      user.role = 'DRIVER';
      if (!user.phoneNumber) user.phoneNumber = cleanedPhone;
      await user.save();
    }

    // 2. Find or create driver profile
    let driver = await DriverModel.findOne({ userId: user._id });
    if (!driver) {
      driver = await DriverModel.create({
        userId: user._id,
        licenseNumber: data.licenseNumber || `DL-${cleanedPhone.slice(-6)}`,
        availabilityStatus: 'AVAILABLE',
      });
    } else {
      if (data.licenseNumber) driver.licenseNumber = data.licenseNumber;
      await driver.save();
    }

    // 3. Vehicle creation or assignment if provided
    let vehicle = null;
    if (data.vehicleRegistration) {
      const reg = data.vehicleRegistration.trim().toUpperCase();
      vehicle = await VehicleModel.findOne({ registrationNumber: reg });
      if (!vehicle) {
        vehicle = await VehicleModel.create({
          registrationNumber: reg,
          model: data.vehicleModel?.trim() || 'Fleet Vehicle',
          vehicleType: data.vehicleType || 'SEDAN',
          driverId: driver._id,
          status: 'ACTIVE',
        });
      } else {
        vehicle.driverId = driver._id;
        if (data.vehicleModel) (vehicle as any).model = data.vehicleModel.trim();
        await vehicle.save();
      }
      driver.vehicleId = vehicle._id as Types.ObjectId;
      await driver.save();
    }

    // 4. Generate welcome invite OTP / credentials
    const welcomeOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.phoneOtp = welcomeOtp;
    user.phoneOtpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h validity for welcome
    await user.save();

    // Dispatch real onboarding SMS to driver's phone
    const smsResult = await smsService.sendDriverInviteSms(cleanedPhone, user.name, welcomeOtp);

    const populatedDriver = await DriverModel.findById(driver._id)
      .populate('userId', 'name email phoneNumber')
      .populate('vehicleId')
      .lean();

    res.status(201).json({
      success: true,
      message: `Driver partner ${user.name} onboarded successfully. SMS invite dispatched.`,
      driver: populatedDriver,
      smsDispatched: {
        to: cleanedPhone,
        provider: smsResult.provider,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
