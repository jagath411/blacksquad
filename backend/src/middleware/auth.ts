import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { AuthenticatedRequest, AuthUser, UserRole } from '../types/auth';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    if (!payload.id || !payload.email || !payload.role) throw new Error('Invalid token');
    req.user = payload;
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
    next();
  };
}
