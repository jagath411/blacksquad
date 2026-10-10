import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MapView } from '../../components/MapView';
import { NotificationBanner, type NotificationItem } from '../../components/NotificationBanner';
import { ProfileModal } from '../../components/ProfileModal';
import { TripHistoryModal } from '../../components/TripHistoryModal';
import { Icon } from '../../components/ui/Icon';
import { useActiveTrip, type TripEvent } from '../../hooks/useActiveTrip';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRoadRoute } from '../../hooks/useRoadRoute';
import { acceptBooking, updateBookingStatus } from '../../services/bookingService';
import { getDriverProfile, updateDriverProfile } from '../../services/driverService';
import { startDriverTracking, type TrackerStatus } from '../../services/driverTracker';
import { onBookingRequestTaken, onNewBookingRequest, setDriverDutyStatus } from '../../services/socket';
import type { BookingData, BookingStatus } from '../../types';
import { callNumber, confirmAction } from '../../utils/dialogs';
import { formatUnifiedError } from '../../utils/errorHandler';
import { toKmh } from '../../utils/geo';
import { MapHeader, RecenterButton, TripPill } from './MapChrome';
import { s } from './homeStyles';
import { buildTripMap } from './tripMap';

// Matches the server's idea of a fresh offer; after this the card is dropped.
const OFFER_SECONDS = 20;

export function DriverHomeScreen({ onLogout }: { onLogout: () => void }) {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const notify = (title: string, body: string, type: NotificationItem['type'] = 'info') =>
    setNotification({ id: Date.now().toString(), title, body, type });

  const [profileVisible, setProfileVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('offline');
  const [offer, setOffer] = useState<BookingData | null>(null);
  const [offerSeconds, setOfferSeconds] = useState(OFFER_SECONDS);
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const stopTrackingRef = useRef<(() => void) | null>(null);

  const { location, setLocation, isLocating, locate, camera } = useDeviceLocation();

  const onTripEvent = useCallback((event: TripEvent) => {
    if (event.type !== 'ENDED') return;
    if (event.status === 'CANCELLED') notify('Trip cancelled', event.booking?.cancellationReason || 'The rider cancelled.', 'warning');
    if (event.status === 'TRIP_COMPLETED') notify('Trip completed', event.booking ? `Collect ₹${event.booking.fare}` : '', 'success');
  }, []);

  const { socket, activeBooking, followBooking, setActiveBooking, endTrip } = useActiveTrip(onTripEvent);
  const route = useRoadRoute(activeBooking, location ? [location.longitude, location.latitude] : null);
  const tripMap = buildTripMap(activeBooking, null, route);
  const markers = location
    ? [
        {
          id: 'self-location',
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? 0,
          isVehicle: true,
          title: isOnline ? 'You (online)' : 'You (offline)',
          color: isOnline ? '#00D084' : '#64748B',
        },
        ...tripMap.markers,
      ]
    : tripMap.markers;

  const startTracking = useCallback(async () => {
    if (!socket || stopTrackingRef.current) return;
    stopTrackingRef.current = await startDriverTracking(socket, setTrackerStatus, (loc) => setLocation(loc));
  }, [socket, setLocation]);

  const stopTracking = useCallback(() => {
    stopTrackingRef.current?.();
    stopTrackingRef.current = null;
    setTrackerStatus('offline');
  }, []);

  // After an app restart, pick up where the driver left off: if they were online
  // or on a trip, start sending GPS again instead of only showing "online".
  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    getDriverProfile()
      .then(async (profile) => {
        if (cancelled) return;
        if (profile.availabilityStatus === 'AVAILABLE' || profile.availabilityStatus === 'ON_TRIP') {
          setIsOnline(true);
          await startTracking();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [socket, startTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  // Ride offers, and their removal once another driver takes them.
  useEffect(() => {
    if (!socket) return;
    const offNew = onNewBookingRequest(socket, (request) => {
      setOffer(request);
      setOfferSeconds(OFFER_SECONDS);
    });
    const offTaken = onBookingRequestTaken(socket, (bookingId) => {
      setOffer((current) => (current?._id === bookingId ? null : current));
    });
    return () => {
      offNew();
      offTaken();
    };
  }, [socket]);

  useEffect(() => {
    if (!offer) return;
    const timer = setInterval(() => {
      setOfferSeconds((left) => {
        if (left <= 1) {
          setOffer(null);
          return OFFER_SECONDS;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [offer]);

  const showError = (cause: unknown) => {
    const err = formatUnifiedError(cause);
    notify(err.title, err.message, 'error');
  };

  const handleToggleDuty = async () => {
    setBusy(true);
    try {
      if (isOnline) {
        await updateDriverProfile({ availabilityStatus: 'OFFLINE' });
        if (socket) setDriverDutyStatus(socket, 'OFFLINE');
        stopTracking();
        setIsOnline(false);
        setOffer(null);
        notify('You are offline', 'You will not receive ride requests.', 'info');
      } else {
        await updateDriverProfile({ availabilityStatus: 'AVAILABLE' });
        if (socket) setDriverDutyStatus(socket, 'AVAILABLE');
        await startTracking();
        setIsOnline(true);
        notify('You are online', 'Your location is shared while you are online.', 'success');
      }
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (bookingId: string) => {
    setBusy(true);
    try {
      const booking = await acceptBooking(bookingId);
      followBooking(booking);
      setOffer(null);
      notify('Ride accepted', 'Head to the pickup point and ask the rider for their PIN.', 'success');
    } catch (cause) {
      setOffer(null);
      showError(cause);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: BookingStatus, options?: { otp?: string; cancellationReason?: string }) => {
    if (!activeBooking) return;
    setBusy(true);
    try {
      const updated = await updateBookingStatus(activeBooking._id, status, options);
      if (status === 'TRIP_COMPLETED' || status === 'CANCELLED') endTrip(status, updated);
      else setActiveBooking(updated);
      return true;
    } catch (cause) {
      showError(cause);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleStartTrip = async () => {
    if (!/^\d{4}$/.test(pin.trim())) {
      notify('Enter the PIN', 'Ask the rider for their 4-digit PIN.', 'warning');
      return;
    }
    if (await setStatus('TRIP_STARTED', { otp: pin.trim() })) {
      setPinModal(false);
      setPin('');
    }
  };

  const handleDropTrip = async () => {
    const ok = await confirmAction('Cancel this trip?', 'The rider will be told and you will go back online.', 'Cancel trip');
    if (ok) await setStatus('CANCELLED', { cancellationReason: 'Cancelled by driver' });
  };

  const rider = typeof activeBooking?.customerId === 'object' ? activeBooking.customerId : undefined;
  const routeText = route ? `${route.distanceKm} km • ${route.durationMins} min` : undefined;
  const nextStep = route?.steps?.[0]?.instruction;

  return (
    <View style={s.container}>
      <NotificationBanner notification={notification} onDismiss={() => setNotification(null)} />

      <View style={s.mapWrapper}>
        <MapView center={camera.center} zoom={camera.zoom} markers={markers} route={tripMap.polyline} style={s.mapFrame} />
        <MapHeader label="DRIVER PORTAL" onHistory={() => setHistoryVisible(true)} onProfile={() => setProfileVisible(true)} />
        <RecenterButton isLocating={isLocating} onPress={() => void locate(true)} />
        {activeBooking && (
          <TripPill
            title={
              activeBooking.status === 'DRIVER_ACCEPTED'
                ? `Heading to pickup${routeText ? ` • ${routeText}` : ''}`
                : activeBooking.status === 'DRIVER_ARRIVING'
                  ? 'At pickup • waiting for rider'
                  : `To drop-off${routeText ? ` • ${routeText}` : ''}`
            }
            subtitle={activeBooking.status === 'DRIVER_ARRIVING' ? undefined : nextStep}
          />
        )}
      </View>

      {offer && !activeBooking && (
        <View style={s.incomingOverlay}>
          <View style={s.incomingCard}>
            <View style={s.incomingTop}>
              <View style={s.incomingBadge}>
                <Text style={s.incomingBadgeText}>NEW RIDE REQUEST</Text>
              </View>
              <Text style={s.incomingTimerText}>{offerSeconds}s</Text>
            </View>
            <Text style={s.incomingFare}>₹{offer.fare}</Text>
            <Text style={s.incomingTier}>
              {offer.distanceKm ? `${offer.distanceKm} km trip` : offer.serviceTier}
            </Text>
            <View style={s.incomingLocations}>
              <View style={s.locRow}>
                <View style={s.pickupPointDot} />
                <Text style={s.locText} numberOfLines={1}>
                  {offer.pickupAddress}
                </Text>
              </View>
              <View style={s.locRow}>
                <View style={s.dropPointSquare} />
                <Text style={s.locText} numberOfLines={1}>
                  {offer.dropAddress}
                </Text>
              </View>
            </View>
            <View style={s.incomingActions}>
              <Pressable style={s.declineBtn} onPress={() => setOffer(null)}>
                <Text style={s.declineBtnText}>Decline</Text>
              </Pressable>
              <Pressable style={s.acceptBtn} disabled={busy} onPress={() => void handleAccept(offer._id)}>
                <Text style={s.acceptBtnText}>ACCEPT RIDE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={s.driverControlSheet}>
        <View style={s.sheetHandle} />

        {activeBooking ? (
          <View style={s.activeTripContent}>
            <View style={s.tripHeader}>
              <View>
                <Text style={s.tripKicker}>{rider?.name ? `RIDER: ${rider.name.toUpperCase()}` : 'ACTIVE TRIP'}</Text>
                <Text style={s.tripFare}>₹{activeBooking.fare}</Text>
              </View>
              {rider?.phoneNumber ? (
                <Pressable accessibilityLabel="Call rider" style={s.profileAvatarBtn} onPress={() => callNumber(rider.phoneNumber!)}>
                  <Icon name="call" size={16} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>

            <View style={s.tripLocations}>
              <View style={s.locRow}>
                <View style={s.pickupPointDot} />
                <Text style={s.locText}>Pickup: {activeBooking.pickupAddress}</Text>
              </View>
              <View style={s.locRow}>
                <View style={s.dropPointSquare} />
                <Text style={s.locText}>Drop: {activeBooking.dropAddress}</Text>
              </View>
            </View>

            {activeBooking.status === 'DRIVER_ACCEPTED' && (
              <Pressable style={s.actionPrimaryBtn} disabled={busy} onPress={() => void setStatus('DRIVER_ARRIVING')}>
                <Text style={s.actionPrimaryText}>I HAVE ARRIVED AT PICKUP</Text>
              </Pressable>
            )}
            {activeBooking.status === 'DRIVER_ARRIVING' && (
              <Pressable style={s.actionPrimaryBtn} disabled={busy} onPress={() => setPinModal(true)}>
                <Text style={s.actionPrimaryText}>ENTER RIDER PIN & START TRIP</Text>
              </Pressable>
            )}
            {activeBooking.status === 'TRIP_STARTED' && (
              <Pressable
                style={[s.actionPrimaryBtn, { backgroundColor: '#10B981' }]}
                disabled={busy}
                onPress={() => void setStatus('TRIP_COMPLETED')}
              >
                <Text style={s.actionPrimaryText}>COMPLETE TRIP</Text>
              </Pressable>
            )}
            {(activeBooking.status === 'DRIVER_ACCEPTED' || activeBooking.status === 'DRIVER_ARRIVING') && (
              <Pressable style={[s.cancelBtn, { marginTop: 10 }]} disabled={busy} onPress={() => void handleDropTrip()}>
                <Icon name="close-circle" size={16} color="#EF4444" />
                <Text style={s.cancelBtnText}>Cancel trip</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={s.dutyContainer}>
            <View style={s.dutyHeader}>
              <View>
                <Text style={s.dutyTitle}>{isOnline ? 'You are ONLINE' : 'You are OFFLINE'}</Text>
                <Text style={s.dutySub}>
                  {isOnline
                    ? trackerStatus === 'online'
                      ? 'Sharing your location • waiting for rides'
                      : trackerStatus === 'denied'
                        ? 'Location permission is off: riders cannot find you'
                        : 'Starting location…'
                    : 'Go online to receive ride requests'}
                </Text>
              </View>
              <View style={[s.dutyStatusDot, { backgroundColor: isOnline ? '#00D084' : '#64748B' }]} />
            </View>

            {isOnline && location && (
              <View style={s.telemetryCard}>
                <View style={s.telemetryItem}>
                  <Text style={s.telemetryLabel}>SPEED</Text>
                  <Text style={s.telemetryValue}>{toKmh(location.speed)} km/h</Text>
                </View>
                <View style={s.telemetryDivider} />
                <View style={s.telemetryItem}>
                  <Text style={s.telemetryLabel}>HEADING</Text>
                  <Text style={s.telemetryValue}>{Math.round(location.heading ?? 0)}°</Text>
                </View>
                <View style={s.telemetryDivider} />
                <View style={s.telemetryItem}>
                  <Text style={s.telemetryLabel}>GPS</Text>
                  <Text style={[s.telemetryValue, { color: trackerStatus === 'online' ? '#00D084' : '#F59E0B' }]}>
                    {trackerStatus === 'online' ? 'LIVE' : trackerStatus.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={[s.toggleDutyBtn, isOnline ? s.toggleDutyBtnOffline : s.toggleDutyBtnOnline]}
              disabled={busy}
              onPress={() => void handleToggleDuty()}
            >
              <Icon name={isOnline ? 'power' : 'radio'} size={20} color="#FFFFFF" />
              <Text style={s.toggleDutyBtnText}>{isOnline ? 'GO OFFLINE' : 'GO ONLINE & ACCEPT RIDES'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={pinModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.otpModalCard}>
            <View style={s.otpHeader}>
              <Icon name="key" size={32} color="#00D084" />
              <Text style={s.otpModalTitle}>Enter rider PIN</Text>
              <Text style={s.otpModalSub}>Ask the rider for the 4-digit PIN shown in their app</Text>
            </View>
            <TextInput
              style={s.otpInputBox}
              value={pin}
              onChangeText={setPin}
              placeholder="• • • •"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
            <View style={s.otpActions}>
              <Pressable style={s.otpCancelBtn} onPress={() => setPinModal(false)}>
                <Text style={s.otpCancelText}>Back</Text>
              </Pressable>
              <Pressable style={s.otpSubmitBtn} disabled={busy} onPress={() => void handleStartTrip()}>
                <Text style={s.otpSubmitText}>Start trip</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onLogout={() => {
          stopTracking();
          onLogout();
        }}
        role="DRIVER"
      />
      <TripHistoryModal visible={historyVisible} role="DRIVER" onClose={() => setHistoryVisible(false)} />
    </View>
  );
}
