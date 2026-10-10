import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api/client';
import { getActiveBooking } from '../services/bookingService';
import {
  createFleetSocket,
  joinBookingRoom,
  leaveBookingRoom,
  onBookingLocationUpdate,
  onBookingStatusChange,
  type FleetSocket,
} from '../services/socket';
import type { BookingData, BookingStatus, DriverLiveLocation } from '../types';

export type TripEvent =
  | { type: 'STATUS'; status: BookingStatus; booking: BookingData }
  /** status is null when the trip ended while this device was offline and the outcome is unknown. */
  | { type: 'ENDED'; status: 'TRIP_COMPLETED' | 'CANCELLED' | null; booking: BookingData | null };

// Sockets carry updates; this poll only catches anything missed while disconnected.
const RESYNC_INTERVAL_MS = 15_000;

/**
 * The signed-in user's current trip, kept live over the socket.
 * Finished and cancelled trips are cleared and reported once through onEvent.
 */
export function useActiveTrip(onEvent?: (event: TripEvent) => void) {
  const [activeBooking, setActiveBookingState] = useState<BookingData | null>(null);
  const [driverLiveLoc, setDriverLiveLoc] = useState<DriverLiveLocation | null>(null);
  const [socket, setSocket] = useState<FleetSocket | null>(null);
  const bookingRef = useRef<BookingData | null>(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const setActiveBooking = useCallback((booking: BookingData | null) => {
    bookingRef.current = booking;
    setActiveBookingState(booking);
    if (!booking) setDriverLiveLoc(null);
  }, []);

  /** Starts following a trip: stores it and joins its live room. */
  const followBooking = useCallback(
    (booking: BookingData) => {
      setActiveBooking(booking);
      const live = socket;
      if (live) joinBookingRoom(live, booking._id);
    },
    [setActiveBooking, socket],
  );

  const endTrip = useCallback(
    (status: 'TRIP_COMPLETED' | 'CANCELLED' | null, booking: BookingData | null) => {
      const current = bookingRef.current;
      if (current && socket) leaveBookingRoom(socket, current._id);
      setActiveBooking(null);
      onEventRef.current?.({ type: 'ENDED', status, booking: booking ?? current });
    },
    [setActiveBooking, socket],
  );

  // Connect once and load any trip already in progress.
  useEffect(() => {
    let cancelled = false;
    void createFleetSocket()
      .then(async (live) => {
        if (cancelled) return;
        setSocket(live);
        const existing = await getActiveBooking().catch(() => null);
        if (!cancelled && existing) {
          setActiveBooking(existing);
          joinBookingRoom(live, existing._id);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setActiveBooking]);

  // Live updates for the current trip.
  useEffect(() => {
    if (!socket) return;
    const offLocation = onBookingLocationUpdate(socket, (loc) => {
      if (bookingRef.current && loc.bookingId === bookingRef.current._id) setDriverLiveLoc(loc);
    });
    const offStatus = onBookingStatusChange(socket, ({ bookingId, status, booking }) => {
      const current = bookingRef.current;
      if (current && bookingId !== current._id) return;
      if (status === 'TRIP_COMPLETED' || status === 'CANCELLED') {
        if (current) endTrip(status, booking ?? null);
        return;
      }
      const next = booking ?? (current ? { ...current, status } : null);
      if (!next) return;
      setActiveBooking(next);
      onEventRef.current?.({ type: 'STATUS', status, booking: next });
    });
    // Rejoin the trip's room after a reconnect.
    const onReconnect = () => {
      if (bookingRef.current) joinBookingRoom(socket, bookingRef.current._id);
    };
    socket.on('connect', onReconnect);
    return () => {
      offLocation();
      offStatus();
      socket.off('connect', onReconnect);
    };
  }, [socket, endTrip, setActiveBooking]);

  // Periodic resync. A network error changes nothing; only a real answer from the server does.
  useEffect(() => {
    const interval = setInterval(() => {
      getActiveBooking()
        .then((latest) => {
          const current = bookingRef.current;
          if (!latest) {
            if (current) endTrip(null, null);
            return;
          }
          if (!current || latest._id !== current._id || latest.status !== current.status) {
            setActiveBooking(latest);
            if (socket) joinBookingRoom(socket, latest._id);
          }
        })
        .catch((err: unknown) => {
          if (!(err instanceof ApiError)) throw err;
        });
    }, RESYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [socket, endTrip, setActiveBooking]);

  return { socket, activeBooking, setActiveBooking, followBooking, endTrip, driverLiveLoc };
}
