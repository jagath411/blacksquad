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
import { createOtpChallenge } from '../services/otp.service';
import { openBankDetails, sealBankDetails } from '../services/fleet.service';
import type { AuthenticatedRequest } from '../types/auth';
import type { PopulatedRef } from '../types/populated';
import { normalizePhoneNumber, phoneNumberVariants } from './auth.routes';

const onboardDriverSchema = z.object({
  name: z.string().min(2).max(120),
  phoneNumber: z.string().min(8).max(20),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(3).max(80).optional(),
  vehicleRegistration: z.string().min(3).max(30).optional(),
  vehicleModel: z.string().max(80).optional(),
  vehicleType: z.enum(['SEDAN', 'SUV', 'VAN', 'TRUCK']).default('SEDAN'),
});

// Empty strings from the app mean "not set".
const optionalField = (schema: z.ZodString) =>
  z.union([schema, z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));

const bankDetailsSchema = z
  .object({
    accountHolderName: optionalField(z.string().max(120)),
    bankName: optionalField(z.string().max(120)),
    accountNumber: optionalField(z.string().regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits')),
    ifscCode: optionalField(z.string().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code')),
    branchName: optionalField(z.string().max(160)),
    upiId: optionalField(z.string().regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID')),
  })
  .optional();

const profileSchema = z.object({
  licenseNumber: z.string().min(3).max(80).optional(),
  // ON_TRIP is set only by accepting a ride.
  availabilityStatus: z.enum(['OFFLINE', 'AVAILABLE']).optional(),
  bankDetails: bankDetailsSchema,
});

const router = Router();

const withOpenBankDetails = <T extends { bankDetails?: Parameters<typeof openBankDetails>[0] } | null>(driver: T): T =>
  driver ? { ...driver, bankDetails: openBankDetails(driver.bankDetails) } : driver;

// 1. Driver's own profile
router.get('/me', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    let driver = await DriverModel.findOne({ userId: req.user!.id }).populate('vehicleId').lean();
    if (!driver) {
      const created = await DriverModel.create({ userId: req.user!.id, availabilityStatus: 'OFFLINE' });
      driver = await DriverModel.findById(created._id).populate('vehicleId').lean();
    }
    res.json({ success: true, driver: withOpenBankDetails(driver) });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requireAuth, requireRole('DRIVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const changes = profileSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (changes.licenseNumber) update.licenseNumber = changes.licenseNumber;
    if (changes.bankDetails) update.bankDetails = sealBankDetails(changes.bankDetails);

    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (changes.availabilityStatus) {
      update.availabilityStatus = changes.availabilityStatus;
      filter.availabilityStatus = { $ne: 'ON_TRIP' };
    }

    const driver = await DriverModel.findOneAndUpdate(filter, { $set: update }, { new: true, runValidators: true })
      .populate('vehicleId')
      .lean();
    if (!driver) {
      const exists = await DriverModel.exists({ userId: req.user!.id });
      res
        .status(exists ? 409 : 404)
        .json({ success: false, message: exists ? 'Finish your current trip first' : 'Driver profile not found' });
      return;
    }
    res.json({ success: true, driver: withOpenBankDetails(driver) });
  } catch (error) {
    next(error);
  }
});

// 2. Owner: the drivers in their own fleet
router.get('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const drivers = await DriverModel.find({ ownerId: req.user!.id })
      .populate('userId', 'name email phoneNumber')
      .populate('vehicleId')
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = drivers.map((driver) => {
      const driverUser = driver.userId as unknown as PopulatedRef;
      const driverUserId = driverUser?._id?.toString() || driver.userId.toString();
      const live = locationState.get(driverUserId) || null;
      const lastCoords = driver.currentLocation?.coordinates;
      return {
        ...withOpenBankDetails(driver),
        liveLocation:
          live ||
          (lastCoords
            ? {
                driverId: driverUserId,
                driverName: driverUser?.name || 'Driver',
                latitude: lastCoords[1],
                longitude: lastCoords[0],
                receivedAt: driver.lastLocationUpdate?.toISOString() || driver.updatedAt.toISOString(),
              }
            : null),
      };
    });

    res.json({ success: true, drivers: formatted });
  } catch (error) {
    next(error);
  }
});

router.patch('/:driverId/vehicle', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const driverId = req.params.driverId;
    const vehicleId = z.string().parse(req.body.vehicleId);
    if (!driverId || !Types.ObjectId.isValid(driverId) || !Types.ObjectId.isValid(vehicleId)) {
      res.status(400).json({ success: false, message: 'Invalid driver or vehicle id' });
      return;
    }
    const ownerId = req.user!.id;
    const [driver, vehicle] = await Promise.all([
      DriverModel.findOne({ _id: driverId, ownerId }),
      VehicleModel.findOne({ _id: vehicleId, ownerId }),
    ]);
    if (!driver || !vehicle) {
      res.status(404).json({ success: false, message: 'Driver or vehicle not found' });
      return;
    }
    if (vehicle.driverId && vehicle.driverId.toString() !== driver.id) {
      res.status(409).json({ success: false, message: 'Vehicle is already assigned' });
      return;
    }
    await VehicleModel.updateMany({ driverId: driver._id, ownerId }, { $unset: { driverId: 1 } });
    vehicle.driverId = driver._id as Types.ObjectId;
    await vehicle.save();
    driver.vehicleId = vehicle._id;
    await driver.save();
    res.json({ success: true, driver: withOpenBankDetails(driver.toObject()), vehicle });
  } catch (error) {
    next(error);
  }
});

// 3. Owner: invite a driver to their fleet
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = onboardDriverSchema.parse(req.body);
    const phoneNumber = normalizePhoneNumber(data.phoneNumber);
    const ownerId = new Types.ObjectId(req.user!.id);

    let user = await UserModel.findOne({
      $or: [
        { phoneNumber: { $in: phoneNumberVariants(phoneNumber) } },
        ...(data.email ? [{ email: data.email.toLowerCase() }] : []),
      ],
    });

    let driver = user ? await DriverModel.findOne({ userId: user._id }) : null;

    // An existing account can only be added if it is a driver nobody else manages.
    // Customers and owners are never converted, so an owner cannot take over someone else's account.
    if (user) {
      const claimable = user.role === 'DRIVER' && (!driver?.ownerId || driver.ownerId.equals(ownerId));
      if (!claimable) {
        res.status(409).json({
          success: false,
          message: 'This phone number already has a BlackSquad account and cannot be added as your driver.',
        });
        return;
      }
    }

    if (data.vehicleRegistration) {
      const reg = data.vehicleRegistration.trim().toUpperCase();
      const existingVehicle = await VehicleModel.findOne({ registrationNumber: reg }).lean();
      if (existingVehicle && existingVehicle.ownerId?.toString() !== ownerId.toString()) {
        res.status(409).json({ success: false, message: `Vehicle ${reg} is registered to another fleet.` });
        return;
      }
    }

    if (!user) {
      user = await UserModel.create({
        name: data.name.trim(),
        email: data.email ? data.email.toLowerCase() : `driver_${phoneNumber.replace(/\D/g, '')}@blacksquad.internal`,
        phoneNumber,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role: 'DRIVER',
        isActive: true,
      });
    }

    if (!driver) {
      driver = await DriverModel.create({
        userId: user._id,
        ownerId,
        licenseNumber: data.licenseNumber,
        availabilityStatus: 'OFFLINE',
      });
    } else {
      if (data.licenseNumber) driver.licenseNumber = data.licenseNumber;
      driver.ownerId = ownerId;
      await driver.save();
    }

    if (data.vehicleRegistration) {
      const reg = data.vehicleRegistration.trim().toUpperCase();
      let vehicle = await VehicleModel.findOne({ registrationNumber: reg, ownerId });
      if (!vehicle) {
        vehicle = await VehicleModel.create({
          registrationNumber: reg,
          model: data.vehicleModel?.trim() || 'Fleet Vehicle',
          vehicleType: data.vehicleType || 'SEDAN',
          driverId: driver._id,
          ownerId,
          status: 'ACTIVE',
        });
      } else {
        vehicle.driverId = driver._id as Types.ObjectId;
        if (data.vehicleModel) vehicle.set('model', data.vehicleModel.trim());
        await vehicle.save();
      }
      driver.vehicleId = vehicle._id;
      await driver.save();
    }

    const inviteCode = await createOtpChallenge(phoneNumber, 'INVITE');
    const smsResult = await smsService.sendDriverInviteSms(phoneNumber, user.name, inviteCode);

    const populatedDriver = await DriverModel.findById(driver._id)
      .populate('userId', 'name email phoneNumber')
      .populate('vehicleId')
      .lean();

    res.status(201).json({
      success: true,
      message: `Driver partner ${user.name} added. SMS invite sent.`,
      driver: withOpenBankDetails(populatedDriver),
      smsDispatched: { to: phoneNumber, provider: smsResult.provider },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
