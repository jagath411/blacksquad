import { Schema, model, type Document } from 'mongoose';
import type { UserRole } from '../types/auth';

export interface SavedPlace {
  label: string;
  address: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

export interface UserDocument extends Document {
  name: string;
  email: string;
  phoneNumber?: string;
  pushToken?: string;
  savedPlaces: SavedPlace[];
  emergencyContact?: { name?: string; phoneNumber: string };
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  phoneOtp?: string;
  phoneOtpExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, trim: true, maxlength: 30, index: true },
    pushToken: { type: String, trim: true },
    savedPlaces: {
      type: [
        {
          _id: false,
          label: { type: String, required: true, trim: true, maxlength: 40 },
          address: { type: String, required: true, trim: true, maxlength: 300 },
          location: {
            type: { type: String, enum: ['Point'], required: true },
            coordinates: { type: [Number], required: true },
          },
        },
      ],
      default: [],
    },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 120 },
      phoneNumber: { type: String, trim: true, maxlength: 20 },
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['OWNER', 'DRIVER', 'CUSTOMER'], default: 'CUSTOMER', index: true },
    isActive: { type: Boolean, default: true, index: true },
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date },
    phoneOtp: { type: String, select: false },
    phoneOtpExpiry: { type: Date },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>('User', userSchema);
