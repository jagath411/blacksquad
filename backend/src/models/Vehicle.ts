import { Schema, model, type Types } from 'mongoose';

export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'EV';

export interface VehicleDocument {
  _id: Types.ObjectId;
  registrationNumber: string;
  vehicleType: string;
  model?: string;
  fuelType?: FuelType;
  capacity?: number;
  odometerKm?: number;
  insuranceExpiry?: Date;
  pucExpiry?: Date;
  driverId?: Types.ObjectId;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<VehicleDocument>(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    vehicleType: { type: String, required: true, trim: true, maxlength: 60, default: 'SEDAN' },
    model: { type: String, trim: true, maxlength: 80, default: 'Fleet Vehicle' },
    fuelType: {
      type: String,
      enum: ['PETROL', 'DIESEL', 'CNG', 'EV'],
      default: 'DIESEL',
    },
    capacity: { type: Number, min: 1, max: 100, default: 4 },
    odometerKm: { type: Number, min: 0, default: 0 },
    insuranceExpiry: { type: Date },
    pucExpiry: { type: Date },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true },
);

export const VehicleModel = model<VehicleDocument>('Vehicle', vehicleSchema);
