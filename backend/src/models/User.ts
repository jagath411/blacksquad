import { Schema, model, type Document } from 'mongoose';
import type { UserRole } from '../types/auth';

export interface UserDocument extends Document {
  name: string;
  email: string;
  phoneNumber?: string;
  pushToken?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, trim: true, maxlength: 30 },
    pushToken: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['OWNER', 'DRIVER', 'CUSTOMER'], default: 'CUSTOMER', index: true },
    isActive: { type: Boolean, default: true, index: true },
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>('User', userSchema);
