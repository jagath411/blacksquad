import { Schema, model, type Document } from 'mongoose';

export type OtpPurpose = 'LOGIN' | 'INVITE';

export interface OtpChallengeDocument extends Document {
  phoneNumber: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  lastSentAt: Date;
  expiresAt: Date;
}

const otpChallengeSchema = new Schema<OtpChallengeDocument>(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, enum: ['LOGIN', 'INVITE'], default: 'LOGIN' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB removes expired challenges on its own.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallengeModel = model<OtpChallengeDocument>('OtpChallenge', otpChallengeSchema);
