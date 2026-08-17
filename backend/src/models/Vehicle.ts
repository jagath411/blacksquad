import { Schema, model, type Types } from 'mongoose';

export interface VehicleDocument {
  registrationNumber: string;
  vehicleType: string;
  model?: string;
  capacity?: number;
  driverId?: Types.ObjectId;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
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
    vehicleType: { type: String, required: true, trim: true, maxlength: 60 },
    model: { type: String, trim: true, maxlength: 80 },
    capacity: { type: Number, min: 1, max: 100 },
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
