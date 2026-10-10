import crypto from 'crypto';
import { env } from '../config/env';
import { OtpChallengeModel, type OtpPurpose } from '../models/OtpChallenge';
import { hmac, safeEqual } from '../utils/crypto';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const hashCode = (phoneNumber: string, code: string) => hmac(`otp:${phoneNumber}:${code}`);

/** Codes are shown in API responses only for local development, never in production. */
export function shouldExposeDevOtp(config: { NODE_ENV: string; SHOW_DEV_OTP: string } = env): boolean {
  return config.NODE_ENV === 'development' && config.SHOW_DEV_OTP === 'true';
}

/** Creates a fresh code for a phone number, replacing any earlier one. */
export async function createOtpChallenge(phoneNumber: string, purpose: OtpPurpose): Promise<string> {
  const existing = await OtpChallengeModel.findOne({ phoneNumber }).lean();
  // The cooldown limits repeated login codes. An invite never blocks a login code, so a
  // driver who just got their invite can still request a fresh code straight away.
  if (
    purpose === 'LOGIN' &&
    existing?.purpose === 'LOGIN' &&
    Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new OtpError('Please wait a minute before requesting another code.', 429);
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const ttl = purpose === 'INVITE' ? INVITE_TTL_MS : OTP_TTL_MS;
  await OtpChallengeModel.findOneAndUpdate(
    { phoneNumber },
    {
      $set: {
        purpose,
        codeHash: hashCode(phoneNumber, code),
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + ttl),
      },
    },
    { upsert: true },
  );
  return code;
}

/** Checks a code. A challenge is used up on success or after too many wrong tries. */
export async function verifyOtpChallenge(phoneNumber: string, code: string): Promise<void> {
  const challenge = await OtpChallengeModel.findOne({ phoneNumber });
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw new OtpError('Code expired or not found. Please request a new one.', 401);
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    await challenge.deleteOne();
    throw new OtpError('Too many wrong attempts. Please request a new code.', 429);
  }
  if (!safeEqual(challenge.codeHash, hashCode(phoneNumber, code.trim()))) {
    challenge.attempts += 1;
    await challenge.save();
    throw new OtpError('Invalid code. Please check it and try again.', 401);
  }
  await challenge.deleteOne();
}
