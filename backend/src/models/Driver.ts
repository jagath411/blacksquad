import { Schema, model, type Document, type Types } from 'mongoose';

export type AvailabilityStatus = 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP';
export interface DriverDocument extends Document {
  userId: Types.ObjectId;
  licenseNumber?: string;
  vehicleId?: Types.ObjectId;
  availabilityStatus: AvailabilityStatus;
  currentLocation?: { type: 'Point'; coordinates: [number, number] };
  lastLocationUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const driverSchema = new Schema<DriverDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  licenseNumber: { type: String, trim: true, maxlength: 80 },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  availabilityStatus: { type: String, enum: ['OFFLINE', 'AVAILABLE', 'ON_TRIP'], default: 'OFFLINE', index: true },
  currentLocation: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  lastLocationUpdate: { type: Date, index: true },
}, { timestamps: true });
driverSchema.index({ currentLocation: '2dsphere' });
export const DriverModel = model<DriverDocument>('Driver', driverSchema);
