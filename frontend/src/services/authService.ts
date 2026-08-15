import { apiRequest } from './api/client';
import { saveAccessToken } from './tokenStore';
import type { UserRole } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
}

interface LoginResponse { success: boolean; accessToken: string; user: UserProfile }

export async function login(email: string, password: string): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await saveAccessToken(response.accessToken);
  return response.user;
}
export async function register(name: string, email: string, password: string, role: UserRole): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
  await saveAccessToken(response.accessToken);
  return response.user;
}
export async function googleLogin(idToken: string, role: UserRole): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken, role }) });
  await saveAccessToken(response.accessToken);
  return response.user;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const response = await apiRequest<{ success: boolean; user: UserProfile }>('/auth/me');
  return response.user;
}

export async function updateUserProfile(data: { name?: string; phoneNumber?: string }): Promise<UserProfile> {
  const response = await apiRequest<{ success: boolean; user: UserProfile }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.user;
}
