import { apiRequest } from './api/client';

export type BookingStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'TRIP_STARTED'
  | 'TRIP_COMPLETED'
  | 'CANCELLED';

export interface BookingData {
  _id: string;
  customerId: any;
  driverId?: any;
  vehicleId?: any;
  pickupAddress: string;
  dropAddress: string;
  pickupLocation: { type: string; coordinates: [number, number] };
  dropLocation: { type: string; coordinates: [number, number] };
  serviceTier: string;
  status: BookingStatus;
  fare: number;
  distanceKm?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export async function createBooking(payload: {
  pickupAddress: string;
  dropAddress: string;
  pickupCoordinates: [number, number];
  dropCoordinates: [number, number];
  serviceTier: string;
  fare: number;
  distanceKm?: number;
}): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.booking;
}

export async function getActiveBooking(): Promise<BookingData | null> {
  const response = await apiRequest<{ success: boolean; booking: BookingData | null }>('/bookings/active');
  return response.booking;
}

export async function acceptBooking(bookingId: string): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>(`/bookings/${bookingId}/accept`, {
    method: 'POST',
  });
  return response.booking;
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>(`/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return response.booking;
}

export async function getBookingHistory(): Promise<BookingData[]> {
  const response = await apiRequest<{ success: boolean; bookings: BookingData[] }>('/bookings/history');
  return response.bookings;
}
