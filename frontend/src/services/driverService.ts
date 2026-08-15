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
