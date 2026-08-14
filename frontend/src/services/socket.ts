import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api/client';
import { getAccessToken } from './tokenStore';

export interface DriverLocationEvent { driverId: string; latitude: number; longitude: number; speed?: number; heading?: number; accuracy?: number; timestamp: number; receivedAt: string; sequence: number; }
export type FleetSocket = Socket<{ 'fleet:snapshot': (locations: DriverLocationEvent[]) => void; 'fleet:location': (location: DriverLocationEvent) => void }, { 'driver:location': (location: Omit<DriverLocationEvent, 'driverId' | 'receivedAt' | 'sequence'>) => void; 'owner:fleet:subscribe': () => void }>;

export async function createFleetSocket(): Promise<FleetSocket> {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in before connecting to live tracking');
  const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return io(socketUrl, { auth: { token }, transports: ['websocket'], autoConnect: true }) as FleetSocket;
}
