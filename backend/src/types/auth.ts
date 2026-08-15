import type { Request } from 'express';

export type UserRole = 'OWNER' | 'DRIVER' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
