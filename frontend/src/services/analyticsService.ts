import { apiRequest } from './api/client';

export interface AnalyticsSummary {
  grossRevenue: number;
  netFleetProfit: number;
  totalExpenses: number;
  fuelExpenses: number;
  totalTrips: number;
  totalDriverEarnings: number;
  settledPayoutsTotal: number;
  pendingDriverPayouts: number;
  activeVehicles: number;
  activeDrivers: number;
}

export interface DailyAnalytics {
  date: string;
  dayName: string;
  revenue: number;
  expense: number;
  trips: number;
  netProfit: number;
}

export interface ExpenseItem {
  _id: string;
  category: 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'INSURANCE' | 'PERMIT' | 'OTHER';
  amount: number;
  vehicleId?: {
    _id: string;
    registrationNumber: string;
    vehicleType: string;
    model?: string;
  };
  driverId?: {
    _id: string;
    userId?: {
      name: string;
      email: string;
    };
  };
  liters?: number;
  odometerKm?: number;
  notes?: string;
  receiptNumber?: string;
  date: string;
  createdAt: string;
}

export interface DriverPayoutStatement {
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverPhone?: string;
  licenseNumber?: string;
  vehicle?: {
    _id: string;
    registrationNumber: string;
    vehicleType: string;
    model?: string;
  };
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  totalTrips: number;
  grossFares: number;
  totalEarnings: number;
  settledAmount: number;
  pendingBalance: number;
  payoutHistory: Array<{
    _id: string;
    amount: number;
    paymentMethod: string;
    transactionReference?: string;
    settledAt?: string;
  }>;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await apiRequest<{ success: boolean; data: AnalyticsSummary }>('/analytics/summary');
  return res.data;
}

export async function getWeeklyAnalytics(): Promise<DailyAnalytics[]> {
  const res = await apiRequest<{ success: boolean; data: DailyAnalytics[] }>('/analytics/weekly');
  return res.data;
}

export async function getExpenses(): Promise<ExpenseItem[]> {
  const res = await apiRequest<{ success: boolean; data: ExpenseItem[] }>('/analytics/expenses');
  return res.data;
}

export async function createExpense(data: {
  category: string;
  amount: number;
  vehicleId?: string;
  liters?: number;
  odometerKm?: number;
  notes?: string;
  receiptNumber?: string;
  date?: string;
}): Promise<ExpenseItem> {
  const res = await apiRequest<{ success: boolean; data: ExpenseItem }>('/analytics/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(`/analytics/expenses/${id}`, {
    method: 'DELETE',
  });
}

export async function getPayoutStatements(): Promise<DriverPayoutStatement[]> {
  const res = await apiRequest<{ success: boolean; data: DriverPayoutStatement[] }>('/analytics/payouts');
  return res.data;
}

export async function settleDriverPayout(data: {
  driverId: string;
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'UPI' | 'CASH';
  transactionReference: string;
  notes?: string;
}): Promise<any> {
  const res = await apiRequest<{ success: boolean; message: string; data: any }>('/analytics/payouts/settle', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}
