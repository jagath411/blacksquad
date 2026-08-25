import { apiRequest } from './api/client';

export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'EV';

export interface FleetVehicle {
  _id: string;
  registrationNumber: string;
  vehicleType: string;
  model?: string;
  fuelType?: FuelType;
  capacity?: number;
  odometerKm?: number;
  insuranceExpiry?: string;
  pucExpiry?: string;
  driverId?: {
    _id: string;
    userId?: {
      _id: string;
      name: string;
      email: string;
      phoneNumber?: string;
    };
    licenseNumber?: string;
    availabilityStatus?: string;
  };
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export async function getFleetVehicles(): Promise<FleetVehicle[]> {
  const res = await apiRequest<{ success: boolean; vehicles: FleetVehicle[] }>('/vehicles');
  return res.vehicles;
}

export async function createFleetVehicle(data: {
  registrationNumber: string;
  vehicleType: string;
  model?: string;
  fuelType?: FuelType;
  capacity?: number;
  odometerKm?: number;
  insuranceExpiry?: string;
  pucExpiry?: string;
  driverId?: string | null;
  status?: VehicleStatus;
}): Promise<FleetVehicle> {
  const res = await apiRequest<{ success: boolean; vehicle: FleetVehicle }>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.vehicle;
}

export async function updateFleetVehicle(
  vehicleId: string,
  data: Partial<{
    registrationNumber: string;
    vehicleType: string;
    model?: string;
    fuelType?: FuelType;
    capacity?: number;
    odometerKm?: number;
    insuranceExpiry?: string;
    pucExpiry?: string;
    driverId?: string | null;
    status?: VehicleStatus;
  }>
): Promise<FleetVehicle> {
  const res = await apiRequest<{ success: boolean; vehicle: FleetVehicle }>(`/vehicles/${vehicleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.vehicle;
}

export async function deleteFleetVehicle(vehicleId: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(`/vehicles/${vehicleId}`, {
    method: 'DELETE',
  });
}
