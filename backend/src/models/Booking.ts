import { Schema, model, type Document, type Types } from 'mongoose';

export type BookingStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'TRIP_STARTED'
  | 'TRIP_COMPLETED'
  | 'CANCELLED';

export interface BookingDocument extends Document {
  customerId: Types.ObjectId;
  driverId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  pickupLocation: { type: 'Point'; coordinates: [number, number] };
  dropLocation: { type: 'Point'; coordinates: [number, number] };
  pickupAddress: string;
  dropAddress: string;
  serviceTier: string;
  status: BookingStatus;
  fare: number;
  distanceKm?: number;
  startOtp?: string;
  driverRating?: number;
  riderRating?: number;
  cancellationReason?: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updatedAt: Date;
  };
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    pickupLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    dropLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    pickupAddress: { type: String, required: true, trim: true },
    dropAddress: { type: String, required: true, trim: true },
    serviceTier: { type: String, default: 'uberx' },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'ASSIGNED',
        'DRIVER_ACCEPTED',
        'DRIVER_ARRIVING',
        'TRIP_STARTED',
        'TRIP_COMPLETED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
      index: true,
    },
    fare: { type: Number, required: true, min: 0 },
    distanceKm: { type: Number, min: 0 },
    startOtp: {
      type: String,
      default: () => Math.floor(1000 + Math.random() * 9000).toString(),
    },
    driverRating: { type: Number, min: 1, max: 5 },
    riderRating: { type: Number, min: 1, max: 5 },
    cancellationReason: { type: String },
    driverLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      heading: { type: Number },
      speed: { type: Number },
      updatedAt: { type: Date },
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

bookingSchema.index({ pickupLocation: '2dsphere' });
bookingSchema.index({ dropLocation: '2dsphere' });

export const BookingModel = model<BookingDocument>('Booking', bookingSchema);
