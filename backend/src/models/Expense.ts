import { Schema, model, type Document, type Types } from 'mongoose';

export type ExpenseCategory =
  | 'FUEL'
  | 'MAINTENANCE'
  | 'TOLL'
  | 'INSURANCE'
  | 'PERMIT'
  | 'OTHER';

export interface ExpenseDocument extends Document {
  ownerId: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  category: ExpenseCategory;
  amount: number;
  liters?: number;
  odometerKm?: number;
  notes?: string;
  receiptNumber?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', index: true },
    category: {
      type: String,
      enum: ['FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'PERMIT', 'OTHER'],
      required: true,
      default: 'FUEL',
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    liters: { type: Number, min: 0 },
    odometerKm: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 500 },
    receiptNumber: { type: String, trim: true, maxlength: 100 },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const ExpenseModel = model<ExpenseDocument>('Expense', expenseSchema);
