import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { BookingModel } from '../models/Booking';
import { ExpenseModel } from '../models/Expense';
import { PayoutModel } from '../models/Payout';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { openBankDetails, ownerDriverIds, sealBankDetails } from '../services/fleet.service';
import type { PopulatedRef } from '../types/populated';

const router = Router();
router.use(requireAuth, requireRole('OWNER'));

// Drivers keep 80% of fares; the fleet keeps 20%.
const DRIVER_SHARE = 0.8;

type Handler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
const handle = (fn: Handler) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  fn(req, res, next).catch(next);
};

async function driverBalance(driverId: Types.ObjectId) {
  const [bookings, paidPayouts] = await Promise.all([
    BookingModel.find({ driverId, status: 'TRIP_COMPLETED' }).select('fare').lean(),
    PayoutModel.find({ driverId, status: 'PAID' }).lean(),
  ]);
  const grossFares = bookings.reduce((sum, b) => sum + (b.fare || 0), 0);
  const totalEarnings = Math.round(grossFares * DRIVER_SHARE);
  const settledAmount = paidPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  return {
    totalTrips: bookings.length,
    grossFares,
    totalEarnings,
    settledAmount,
    pendingBalance: Math.max(0, totalEarnings - settledAmount),
    paidPayouts,
  };
}

// 1. Overview KPIs for this owner's fleet
router.get(
  '/summary',
  handle(async (req, res) => {
    const ownerId = req.user!.id;
    const driverIds = await ownerDriverIds(ownerId);

    const [completedBookings, expenses, payouts, activeVehicles, activeDrivers] = await Promise.all([
      BookingModel.find({ driverId: { $in: driverIds }, status: 'TRIP_COMPLETED' }).select('fare').lean(),
      ExpenseModel.find({ ownerId }).select('amount category').lean(),
      PayoutModel.find({ ownerId, status: 'PAID' }).select('amount').lean(),
      VehicleModel.countDocuments({ ownerId, status: 'ACTIVE' }),
      DriverModel.countDocuments({ ownerId, availabilityStatus: { $in: ['AVAILABLE', 'ON_TRIP'] } }),
    ]);

    const grossRevenue = completedBookings.reduce((sum, b) => sum + (b.fare || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const fuelExpenses = expenses.filter((e) => e.category === 'FUEL').reduce((sum, e) => sum + (e.amount || 0), 0);
    const settledPayoutsTotal = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDriverCut = Math.round(grossRevenue * DRIVER_SHARE);

    res.json({
      success: true,
      data: {
        grossRevenue,
        netFleetProfit: Math.round(grossRevenue - totalExpenses - totalDriverCut),
        totalExpenses,
        fuelExpenses,
        totalTrips: completedBookings.length,
        totalDriverEarnings: totalDriverCut,
        settledPayoutsTotal,
        pendingDriverPayouts: Math.max(0, totalDriverCut - settledPayoutsTotal),
        activeVehicles,
        activeDrivers,
      },
    });
  }),
);

// 2. Last 7 days of revenue and expenses
router.get(
  '/weekly',
  handle(async (req, res) => {
    const ownerId = req.user!.id;
    const driverIds = await ownerDriverIds(ownerId);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const [dayBookings, dayExpenses] = await Promise.all([
        BookingModel.find({
          driverId: { $in: driverIds },
          status: 'TRIP_COMPLETED',
          completedAt: { $gte: startOfDay, $lte: endOfDay },
        })
          .select('fare')
          .lean(),
        ExpenseModel.find({ ownerId, date: { $gte: startOfDay, $lte: endOfDay } }).select('amount').lean(),
      ]);

      const revenue = dayBookings.reduce((sum, b) => sum + (b.fare || 0), 0);
      const expense = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      days.push({
        date: startOfDay.toISOString().split('T')[0] ?? '',
        dayName: dayNames[startOfDay.getDay()] ?? 'Day',
        revenue,
        expense,
        trips: dayBookings.length,
        netProfit: revenue - expense - Math.round(revenue * DRIVER_SHARE),
      });
    }

    res.json({ success: true, data: days });
  }),
);

// 3. Expenses
const expenseSchema = z.object({
  category: z.enum(['FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'PERMIT', 'OTHER']).default('FUEL'),
  amount: z.number().positive(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  liters: z.number().min(0).optional(),
  odometerKm: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  receiptNumber: z.string().max(100).optional(),
  date: z.string().optional(),
});

router.get(
  '/expenses',
  handle(async (req, res) => {
    const expenses = await ExpenseModel.find({ ownerId: req.user!.id })
      .sort({ date: -1 })
      .populate('vehicleId', 'registrationNumber vehicleType model')
      .populate({ path: 'driverId', select: 'userId', populate: { path: 'userId', select: 'name email' } })
      .limit(50)
      .lean();
    res.json({ success: true, data: expenses });
  }),
);

router.post(
  '/expenses',
  handle(async (req, res) => {
    const ownerId = req.user!.id;
    const body = expenseSchema.parse(req.body);

    if (body.vehicleId && !(Types.ObjectId.isValid(body.vehicleId) && (await VehicleModel.exists({ _id: body.vehicleId, ownerId })))) {
      res.status(404).json({ success: false, message: 'Vehicle not found in your fleet' });
      return;
    }
    if (body.driverId && !(Types.ObjectId.isValid(body.driverId) && (await DriverModel.exists({ _id: body.driverId, ownerId })))) {
      res.status(404).json({ success: false, message: 'Driver not found in your fleet' });
      return;
    }

    const expense = await ExpenseModel.create({
      ownerId,
      category: body.category,
      amount: body.amount,
      vehicleId: body.vehicleId,
      driverId: body.driverId,
      liters: body.liters,
      odometerKm: body.odometerKm,
      notes: body.notes,
      receiptNumber: body.receiptNumber,
      date: body.date ? new Date(body.date) : new Date(),
    });
    res.status(201).json({ success: true, data: expense });
  }),
);

router.delete(
  '/expenses/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    const deleted = id && Types.ObjectId.isValid(id) ? await ExpenseModel.findOneAndDelete({ _id: id, ownerId: req.user!.id }) : null;
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Expense not found' });
      return;
    }
    res.json({ success: true, message: 'Expense deleted successfully' });
  }),
);

// 4. Driver payout statements and settlement
router.get(
  '/payouts',
  handle(async (req, res) => {
    const drivers = await DriverModel.find({ ownerId: req.user!.id })
      .populate('userId', 'name email phoneNumber')
      .populate('vehicleId', 'registrationNumber vehicleType model')
      .lean();

    const statements = await Promise.all(
      drivers.map(async (driver) => {
        const driverUser = driver.userId as unknown as PopulatedRef;
        const balance = await driverBalance(driver._id);
        return {
          driverId: driver._id,
          driverName: driverUser?.name || 'Driver',
          driverEmail: driverUser?.email || '',
          driverPhone: driverUser?.phoneNumber || '',
          licenseNumber: driver.licenseNumber,
          vehicle: driver.vehicleId,
          bankDetails: openBankDetails(driver.bankDetails) || {},
          totalTrips: balance.totalTrips,
          grossFares: balance.grossFares,
          totalEarnings: balance.totalEarnings,
          settledAmount: balance.settledAmount,
          pendingBalance: balance.pendingBalance,
          payoutHistory: balance.paidPayouts.map((p) => ({ ...p, bankDetails: openBankDetails(p.bankDetails) })),
        };
      }),
    );

    res.json({ success: true, data: statements });
  }),
);

const settleSchema = z.object({
  driverId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'UPI', 'CASH']).default('UPI'),
  transactionReference: z.string().trim().min(3).max(100),
  notes: z.string().max(500).optional(),
});

router.post(
  '/payouts/settle',
  handle(async (req, res) => {
    const ownerId = req.user!.id;
    const body = settleSchema.parse(req.body);

    if (await PayoutModel.exists({ transactionReference: body.transactionReference })) {
      res.status(409).json({
        success: false,
        message: `Transaction reference '${body.transactionReference}' has already been recorded.`,
      });
      return;
    }

    const driver = Types.ObjectId.isValid(body.driverId)
      ? await DriverModel.findOne({ _id: body.driverId, ownerId }).lean()
      : null;
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver not found in your fleet' });
      return;
    }

    const { pendingBalance } = await driverBalance(driver._id);
    if (body.amount > pendingBalance) {
      res.status(400).json({
        success: false,
        message: `Payout amount ₹${body.amount} exceeds pending balance of ₹${pendingBalance}.`,
      });
      return;
    }

    try {
      const payout = await PayoutModel.create({
        ownerId,
        driverId: driver._id,
        amount: body.amount,
        driverCommissionShare: DRIVER_SHARE * 100,
        periodStart: new Date(Date.now() - 7 * 86_400_000),
        periodEnd: new Date(),
        status: 'PAID',
        paymentMethod: body.paymentMethod,
        transactionReference: body.transactionReference,
        bankDetails: sealBankDetails(driver.bankDetails) || {},
        settledAt: new Date(),
      });
      res.status(201).json({ success: true, message: 'Driver payout recorded successfully', data: payout });
    } catch (createErr) {
      if ((createErr as { code?: number })?.code === 11000) {
        res.status(409).json({
          success: false,
          message: `Transaction reference '${body.transactionReference}' has already been processed.`,
        });
        return;
      }
      throw createErr;
    }
  }),
);

export default router;
