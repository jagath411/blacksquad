import { Schema, model, type Document, type Types } from 'mongoose';

export interface DriverLocationDocument extends Document {
  driverId: Types.ObjectId;
  location: { type: 'Point'; coordinates: [number, number] };
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: Date;
  createdAt: Date;
}
const driverLocationSchema = new Schema<DriverLocationDocument>({
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
  location: { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } },
  speed: { type: Number, min: 0 }, heading: { type: Number, min: 0, max: 360 }, accuracy: { type: Number, min: 0 },
  timestamp: { type: Date, required: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ driverId: 1, timestamp: -1 });
export const DriverLocationModel = model<DriverLocationDocument>('DriverLocation', driverLocationSchema);
