import { apiRequest } from './api/client';
import { saveAccessToken } from './tokenStore';
import type { UserRole } from '../types';

interface LoginResponse { success: boolean; accessToken: string; user: { id: string; name: string; email: string; role: UserRole } }
export async function login(email: string, password: string): Promise<LoginResponse['user']> {
  const response = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await saveAccessToken(response.accessToken);
  return response.user;
}
export async function register(name: string, email: string, password: string, role: UserRole): Promise<LoginResponse['user']> {
  const response = await apiRequest<LoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
  await saveAccessToken(response.accessToken);
  return response.user;
}
