import { Schema, model, type Document, type Types } from 'mongoose';

export type PayoutStatus = 'PENDING' | 'PAID';
export type PaymentMethod = 'BANK_TRANSFER' | 'UPI' | 'CASH';

export interface PayoutDocument extends Document {
  ownerId: Types.ObjectId;
  driverId: Types.ObjectId;
  amount: number;
  driverCommissionShare: number;
  tripsCount: number;
  periodStart: Date;
  periodEnd: Date;
  status: PayoutStatus;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<PayoutDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    driverCommissionShare: { type: Number, default: 80 }, // Percentage e.g. 80%
    tripsCount: { type: Number, default: 0 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'UPI', 'CASH'],
      default: 'UPI',
    },
    transactionReference: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    settledAt: { type: Date },
  },
  { timestamps: true },
);

export const PayoutModel = model<PayoutDocument>('Payout', payoutSchema);
