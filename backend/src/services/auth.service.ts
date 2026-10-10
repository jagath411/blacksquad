import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { RefreshTokenModel } from '../models/RefreshToken';
import { UserModel, type UserDocument } from '../models/User';
import type { AuthUser } from '../types/auth';
import { sha256 } from '../utils/crypto';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export class AuthError extends Error {
  public readonly statusCode = 401;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60 },
  );
}

export function toAuthUser(user: Pick<UserDocument, 'id' | 'email' | 'name' | 'role'>): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function issueTokens(user: AuthUser): Promise<IssuedTokens> {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await RefreshTokenModel.create({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

/**
 * Exchanges a refresh token for a new pair. Each refresh token works once:
 * presenting a token that was already used revokes every session for that user.
 */
export async function rotateRefreshToken(refreshToken: string): Promise<{ user: UserDocument; tokens: IssuedTokens }> {
  const tokenHash = sha256(refreshToken);
  const now = new Date();
  const record = await RefreshTokenModel.findOneAndUpdate(
    { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
  );

  if (!record) {
    const reused = await RefreshTokenModel.findOne({ tokenHash }).lean();
    if (reused) await revokeAllSessions(reused.userId.toString());
    throw new AuthError('Session expired. Please sign in again.');
  }

  const user = await UserModel.findOne({ _id: record.userId, isActive: true });
  if (!user) throw new AuthError('Account is not active');

  return { user, tokens: await issueTokens(toAuthUser(user)) };
}

/** Revokes one session. Returns the user it belonged to, if it was still active. */
export async function revokeRefreshToken(refreshToken: string): Promise<string | null> {
  const record = await RefreshTokenModel.findOneAndUpdate(
    { tokenHash: sha256(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  ).lean();
  return record ? record.userId.toString() : null;
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}
