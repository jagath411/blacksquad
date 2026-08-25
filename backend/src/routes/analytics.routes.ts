import { Router, type Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { BookingModel } from '../models/Booking';
import { ExpenseModel } from '../models/Expense';
import { PayoutModel } from '../models/Payout';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';

const router = Router();

// 1. Overview Summary KPIs
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ownerId = req.user?.id;

    // Total Completed Bookings
    const completedBookings = await BookingModel.find({ status: 'TRIP_COMPLETED' }).lean();
    const grossRevenue = completedBookings.reduce((sum, b) => sum + (b.fare || 0), 0);
    const totalTrips = completedBookings.length;

    // Total Expenses
    const expenses = await ExpenseModel.find(ownerId ? { ownerId } : {}).lean();
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const fuelExpenses = expenses
      .filter((e) => e.category === 'FUEL')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Settled vs Pending Driver Payouts
    const payouts = await PayoutModel.find(ownerId ? { ownerId } : {}).lean();
    const settledPayoutsTotal = payouts
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Standard Commission Model (80% Driver / 20% Fleet Platform)
    const totalDriverCut = Math.round(grossRevenue * 0.8);
    const pendingDriverPayouts = Math.max(0, totalDriverCut - settledPayoutsTotal);
    const netFleetProfit = Math.round(grossRevenue - totalExpenses - totalDriverCut);

    // Active Fleet & Driver Counts
    const activeVehicles = await VehicleModel.countDocuments({ status: 'ACTIVE' });
    const activeDrivers = await DriverModel.countDocuments({
      availabilityStatus: { $in: ['AVAILABLE', 'ON_TRIP'] },
    });

    res.json({
      success: true,
      data: {
        grossRevenue,
        netFleetProfit,
        totalExpenses,
        fuelExpenses,
        totalTrips,
        totalDriverEarnings: totalDriverCut,
        settledPayoutsTotal,
        pendingDriverPayouts,
        activeVehicles,
        activeDrivers,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to calculate analytics summary' });
  }
});

// 2. 7-Day Weekly Revenue & Expense Series for Charts
router.get('/weekly', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ownerId = req.user?.id;
    const now = new Date();
    const days: Array<{
      date: string;
      dayName: string;
      revenue: number;
      expense: number;
      trips: number;
      netProfit: number;
    }> = [];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayBookings = await BookingModel.find({
        status: 'TRIP_COMPLETED',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }).lean();

      const dayExpenses = await ExpenseModel.find({
        ...(ownerId ? { ownerId } : {}),
        date: { $gte: startOfDay, $lte: endOfDay },
      }).lean();

      const revenue = dayBookings.reduce((sum, b) => sum + (b.fare || 0), 0);
      const expense = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const driverCut = Math.round(revenue * 0.8);
      const netProfit = revenue - expense - driverCut;

      days.push({
        date: startOfDay.toISOString().split('T')[0] ?? '',
        dayName: dayNames[startOfDay.getDay()] ?? 'Day',
        revenue,
        expense,
        trips: dayBookings.length,
        netProfit,
      });
    }

    res.json({
      success: true,
      data: days,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch weekly series' });
  }
});

// 3. Expenses List & Creation
const expenseSchema = z.object({
  category: z.enum(['FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'PERMIT', 'OTHER']).default('FUEL'),
  amount: z.number().positive(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  liters: z.number().optional(),
  odometerKm: z.number().optional(),
  notes: z.string().optional(),
  receiptNumber: z.string().optional(),
  date: z.string().optional(),
});

router.get('/expenses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ownerId = req.user?.id;
    const expenses = await ExpenseModel.find(ownerId ? { ownerId } : {})
      .sort({ date: -1 })
      .populate('vehicleId', 'registrationNumber vehicleType model')
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email' },
      })
      .limit(50)
      .lean();

    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve expenses' });
  }
});

router.post('/expenses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = expenseSchema.parse(req.body);
    const ownerId = req.user?.id;

    const expense = await ExpenseModel.create({
      ownerId: ownerId || new mongoose.Types.ObjectId(),
      category: body.category,
      amount: body.amount,
      vehicleId: body.vehicleId ? new mongoose.Types.ObjectId(body.vehicleId) : undefined,
      driverId: body.driverId ? new mongoose.Types.ObjectId(body.driverId) : undefined,
      liters: body.liters,
      odometerKm: body.odometerKm,
      notes: body.notes,
      receiptNumber: body.receiptNumber,
      date: body.date ? new Date(body.date) : new Date(),
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to record expense' });
  }
});

router.delete('/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await ExpenseModel.findByIdAndDelete(id);
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete expense' });
  }
});

// 4. Driver Payout Statements & Settlement
router.get('/payouts', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const drivers = await DriverModel.find()
      .populate('userId', 'name email phoneNumber')
      .populate('vehicleId', 'registrationNumber vehicleType model')
      .lean();

    const statements = await Promise.all(
      drivers.map(async (driver) => {
        // Find completed bookings for driver
        const bookings = await BookingModel.find({
          driverId: driver._id,
          status: 'TRIP_COMPLETED',
        }).lean();

        const totalFares = bookings.reduce((sum, b) => sum + (b.fare || 0), 0);
        const totalDriverEarnings = Math.round(totalFares * 0.8);

        // Find settled payouts for driver
        const paidPayouts = await PayoutModel.find({
          driverId: driver._id,
          status: 'PAID',
        }).lean();

        const settledAmount = paidPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingBalance = Math.max(0, totalDriverEarnings - settledAmount);

        return {
          driverId: driver._id,
          driverName: (driver.userId as any)?.name || 'Driver',
          driverEmail: (driver.userId as any)?.email || '',
          driverPhone: (driver.userId as any)?.phoneNumber || '',
          licenseNumber: driver.licenseNumber,
          vehicle: driver.vehicleId,
          bankDetails: driver.bankDetails || {},
          totalTrips: bookings.length,
          grossFares: totalFares,
          totalEarnings: totalDriverEarnings,
          settledAmount,
          pendingBalance,
          payoutHistory: paidPayouts,
        };
      }),
    );

    res.json({ success: true, data: statements });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payout statements' });
  }
});

const settleSchema = z.object({
  driverId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'UPI', 'CASH']).default('UPI'),
  transactionReference: z.string().min(3),
  notes: z.string().optional(),
});

router.post('/payouts/settle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = settleSchema.parse(req.body);
    const ownerId = req.user?.id;

    // Concurrency Guard: Check for duplicate transaction reference
    const existingRef = await PayoutModel.findOne({
      transactionReference: body.transactionReference.trim(),
    }).lean();

    if (existingRef) {
      res.status(409).json({
        success: false,
        message: `Transaction reference '${body.transactionReference}' has already been settled and recorded.`,
        data: existingRef,
      });
      return;
    }

    const driver = await DriverModel.findById(body.driverId).lean();
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver not found' });
      return;
    }

    // Calculate pending balance
    const bookings = await BookingModel.find({
      driverId: driver._id,
      status: 'TRIP_COMPLETED',
    }).lean();
    const totalFares = bookings.reduce((sum, b) => sum + (b.fare || 0), 0);
    const totalDriverEarnings = Math.round(totalFares * 0.8);

    const paidPayouts = await PayoutModel.find({
      driverId: driver._id,
      status: 'PAID',
    }).lean();
    const settledAmount = paidPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingBalance = Math.max(0, totalDriverEarnings - settledAmount);

    if (body.amount > pendingBalance && pendingBalance > 0) {
      res.status(400).json({
        success: false,
        message: `Payout amount ₹${body.amount} exceeds pending balance of ₹${pendingBalance}.`,
      });
      return;
    }

    const payout = await PayoutModel.create({
      ownerId: ownerId || new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(body.driverId),
      amount: body.amount,
      driverCommissionShare: 80,
      periodStart: new Date(Date.now() - 7 * 86400000),
      periodEnd: new Date(),
      status: 'PAID',
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference.trim(),
      bankDetails: driver.bankDetails || {},
      settledAt: new Date(),
    });

    res.status(201).json({ success: true, message: 'Driver payout recorded successfully', data: payout });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to settle payout' });
  }
});

export default router;
