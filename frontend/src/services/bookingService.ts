import { apiRequest } from './api/client';
import type { BookingData, BookingStatus } from '../types';

export async function createBooking(payload: {
  pickupAddress: string;
  dropAddress: string;
  pickupCoordinates: [number, number];
  dropCoordinates: [number, number];
  serviceTier: string;
}): Promise<BookingData> {
  const response = await apiRequest<{ success: boolean; booking: BookingData }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.booking;
}

/** The signed-in user's current trip, or null. Throws when the server cannot be reached. */
export async function getActiveBooking(): Promise<BookingData | null> {
  const response = await apiRequest<{ success: boolean; booking: BookingData | null }>('/bookings/active');
  return response.booking;
}

export interface FareQuote {
  tier: string;
  name: string;
  fare: number;
  distanceKm: number;
}

/** Server prices for every service tier between two points ([lng, lat]). */
export async function getFareQuotes(
  pickupCoordinates: [number, number],
  dropCoordinates: [number, number],
): Promise<FareQuote[]> {
  const response = await apiRequest<{ success: boolean; quotes: FareQuote[] }>('/bookings/quote', {
    method: 'POST',
    body: JSON.stringify({ pickupCoordinates, dropCoordinates }),
  });
  return response.quotes;
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
