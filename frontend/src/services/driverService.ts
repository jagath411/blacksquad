import { apiRequest } from './api/client';

export interface BankDetails {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
}

export interface DriverProfile {
  _id: string;
  userId: string;
  licenseNumber?: string;
  availabilityStatus: 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP';
  bankDetails?: BankDetails;
  vehicleId?: any;
}

export async function getDriverProfile(): Promise<DriverProfile> {
  const response = await apiRequest<{ success: boolean; driver: DriverProfile }>('/drivers/me');
  return response.driver;
}

export async function updateDriverProfile(data: {
  licenseNumber?: string;
  availabilityStatus?: 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP';
  bankDetails?: BankDetails;
}): Promise<DriverProfile> {
  const response = await apiRequest<{ success: boolean; driver: DriverProfile }>('/drivers/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.driver;
}

export async function updateBankDetails(bankDetails: BankDetails): Promise<DriverProfile> {
  return updateDriverProfile({ bankDetails });
}

export interface OnboardDriverPayload {
  name: string;
  phoneNumber: string;
  email?: string;
  licenseNumber?: string;
  vehicleRegistration?: string;
  vehicleModel?: string;
  vehicleType?: 'SEDAN' | 'SUV' | 'VAN' | 'TRUCK';
}

export async function onboardDriver(payload: OnboardDriverPayload): Promise<{
  success: boolean;
  message: string;
  driver: any;
  smsDispatched: { to: string; welcomeOtp: string };
}> {
  return apiRequest<{
    success: boolean;
    message: string;
    driver: any;
    smsDispatched: { to: string; welcomeOtp: string };
  }>('/drivers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type DriverProfileData = DriverProfile;
