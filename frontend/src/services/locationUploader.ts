import { ApiError, apiRequest } from './api/client';
import { getFleetSocket } from './socket';

export interface GpsFix {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
}

// Fixes worse than this are too imprecise to show a rider or use for dispatch.
const MAX_ACCURACY_METERS = 100;

// The newest fix that could not be sent. Only the latest matters: older ones are already stale.
let pending: GpsFix | null = null;

export const isUsableFix = (fix: GpsFix) =>
  Number.isFinite(fix.latitude) &&
  Number.isFinite(fix.longitude) &&
  (fix.accuracy === undefined || fix.accuracy <= MAX_ACCURACY_METERS);

/**
 * Sends a driver's position. Uses the live socket when connected, otherwise HTTP.
 * When the network is down the fix is kept and sent with the next successful update.
 */
export async function uploadFix(fix: GpsFix): Promise<void> {
  if (!isUsableFix(fix)) return;
  if (pending && pending.timestamp > fix.timestamp) return;

  const socket = getFleetSocket();
  if (socket?.connected) {
    socket.emit('driver:location', fix);
    pending = null;
    return;
  }

  try {
    await apiRequest('/drivers/location', { method: 'POST', body: JSON.stringify(fix) });
    pending = null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) pending = fix;
  }
}

/** Sends the fix held while offline, if any. Call when the connection comes back. */
export async function flushPendingFix(): Promise<void> {
  const held = pending;
  if (held) await uploadFix(held);
}

export const hasPendingFix = () => pending !== null;
