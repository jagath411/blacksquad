import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api/client';
import { getAccessToken } from './tokenStore';
import type { BookingData, BookingStatus, DriverLiveLocation } from '../types';

export interface DriverLocationEvent {
  driverId: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  receivedAt: string;
  sequence: number;
}

export type FleetSocket = Socket;

let globalSocket: FleetSocket | null = null;

export async function createFleetSocket(): Promise<FleetSocket> {
  if (globalSocket && globalSocket.connected) {
    return globalSocket;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Sign in before connecting to live tracking');
  const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');

  const socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  globalSocket = socket;
  return socket;
}

export function getFleetSocket(): FleetSocket | null {
  return globalSocket;
}

export function joinBookingRoom(socket: FleetSocket, bookingId: string): void {
  socket.emit('booking:join', bookingId);
}

export function leaveBookingRoom(socket: FleetSocket, bookingId: string): void {
  socket.emit('booking:leave', bookingId);
}

export function setDriverDutyStatus(socket: FleetSocket, status: 'AVAILABLE' | 'OFFLINE' | 'ON_TRIP'): void {
  socket.emit('driver:status', status);
}

export function onBookingLocationUpdate(
  socket: FleetSocket,
  callback: (location: DriverLiveLocation) => void,
): () => void {
  const handler = (data: DriverLiveLocation) => callback(data);
  socket.on('booking:location:update', handler);
  return () => socket.off('booking:location:update', handler);
}

export function onBookingStatusChange(
  socket: FleetSocket,
  callback: (payload: { bookingId: string; status: BookingStatus; booking?: BookingData }) => void,
): () => void {
  const handler = (payload: { bookingId: string; status: BookingStatus; booking?: BookingData }) =>
    callback(payload);
  socket.on('booking:status:change', handler);
  return () => socket.off('booking:status:change', handler);
}

export function onNewBookingRequest(
  socket: FleetSocket,
  callback: (request: BookingData) => void,
): () => void {
  const handler = (request: BookingData) => callback(request);
  socket.on('booking:new:request', handler);
  return () => socket.off('booking:new:request', handler);
}
