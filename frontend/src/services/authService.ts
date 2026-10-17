import { apiRequest } from './api/client';
import { clearAllStorage, getRefreshToken, saveSession } from './tokenStore';
import { disconnectFleetSocket } from './socket';
import type { UserRole } from '../types';

export interface SavedPlace {
  label: string;
  address: string;
  /** [longitude, latitude] */
  coordinates: [number, number];
}

export interface EmergencyContact {
  name?: string;
  phoneNumber: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  savedPlaces?: SavedPlace[];
  emergencyContact?: EmergencyContact | null;
}

interface LoginResponse { success: boolean; accessToken: string; refreshToken: string; user: UserProfile }

export async function login(email: string, password: string): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await saveSession(response);
  return response.user;
}
export async function register(name: string, email: string, password: string): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  await saveSession(response);
  return response.user;
}
export async function googleLogin(idToken: string): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
  await saveSession(response);
  return response.user;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const response = await apiRequest<{ success: boolean; user: UserProfile }>('/auth/me');
  return response.user;
}

export async function updateUserProfile(data: {
  name?: string;
  phoneNumber?: string;
  savedPlaces?: SavedPlace[];
  emergencyContact?: EmergencyContact | null;
}): Promise<UserProfile> {
  const response = await apiRequest<{ success: boolean; user: UserProfile }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.user;
}

export async function sendPhoneOtp(
  phoneNumber: string,
): Promise<{
  success: boolean;
  message: string;
  phoneNumber: string;
  smsProvider?: string;
  isLiveGateway?: boolean;
  smsPreview?: string;
  devOtp?: string;
}> {
  return apiRequest<{
    success: boolean;
    message: string;
    phoneNumber: string;
    smsProvider?: string;
    isLiveGateway?: boolean;
    smsPreview?: string;
    devOtp?: string;
  }>('/auth/phone/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function verifyPhoneOtp(phoneNumber: string, otp: string): Promise<UserProfile> {
  const response = await apiRequest<LoginResponse>('/auth/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, otp }),
  });
  await saveSession(response);
  return response.user;
}


/** Signs out on the server and on this device, and closes the live connection. */
export async function logout(): Promise<void> {
  disconnectFleetSocket();
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
  }
  await clearAllStorage();
}

/** Permanently deletes the signed-in account, then signs out on this device. */
export async function deleteAccount(): Promise<void> {
  await apiRequest('/auth/me', { method: 'DELETE' });
  disconnectFleetSocket();
  await clearAllStorage();
}
