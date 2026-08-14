import { Schema, model, type Document } from 'mongoose';
import type { UserRole } from '../types/auth';

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['OWNER', 'DRIVER', 'CUSTOMER'], default: 'CUSTOMER', index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export const UserModel = model<UserDocument>('User', userSchema);
