import { apiRequest } from './api/client';
import type { BookingData, BookingStatus } from '../types';

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
  const response = await apiRequest<{ success: boolean; booking: BookingData | null }>(
    '/bookings/active',
  );
  return response.booking;
}

export async function acceptBooking(bookingId: string): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>(
    `/bookings/${bookingId}/accept`,
    {
      method: 'POST',
    },
  );
  return response.booking;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  options?: { otp?: string; cancellationReason?: string },
): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>(
    `/bookings/${bookingId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, ...options }),
    },
  );
  return response.booking;
}

export async function rateBooking(
  bookingId: string,
  rating: number,
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/bookings/${bookingId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });
}

export async function getBookingHistory(): Promise<BookingData[]> {
  const response = await apiRequest<{ success: boolean; bookings: BookingData[] }>(
    '/bookings/history',
  );
  return response.bookings;
}
