import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { MapView } from '../../components/MapView';
import { NotificationBanner, type NotificationItem } from '../../components/NotificationBanner';
import { ProfileModal } from '../../components/ProfileModal';
import { TripHistoryModal } from '../../components/TripHistoryModal';
import { Icon } from '../../components/ui/Icon';
import { useActiveTrip, type TripEvent } from '../../hooks/useActiveTrip';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRoadRoute } from '../../hooks/useRoadRoute';
import { createBooking, getFareQuotes, rateBooking, updateBookingStatus, type FareQuote } from '../../services/bookingService';
import { geocodeAddress } from '../../services/geocodingService';
import type { BookingData } from '../../types';
import { callNumber, confirmAction } from '../../utils/dialogs';
import { formatUnifiedError } from '../../utils/errorHandler';
import { MapHeader, RecenterButton, TripPill } from './MapChrome';
import { s } from './homeStyles';
import { buildTripMap, driverPosition } from './tripMap';

const TIER_DETAILS: Record<string, { name: string; desc: string; icon: string }> = {
  uberx: { name: 'BlackSquad Express', desc: 'Comfortable city sedan', icon: 'car-sport' },
  comfort: { name: 'Fleet Comfort Van', desc: 'Extra space for groups and luggage', icon: 'bus' },
  heavy: { name: 'Heavy Freight Hauler', desc: 'Goods and commercial loads', icon: 'cube' },
};

interface PlannedTrip {
  pickupAddress: string;
  pickupCoordinates: [number, number];
  dropAddress: string;
  dropCoordinates: [number, number];
  quotes: FareQuote[];
}

const CURRENT_LOCATION = 'Current location';

export function CustomerHomeScreen({ onLogout }: { onLogout: () => void }) {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const notify = (title: string, body: string, type: NotificationItem['type'] = 'info') =>
    setNotification({ id: Date.now().toString(), title, body, type });

  const [profileVisible, setProfileVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [pickupText, setPickupText] = useState(CURRENT_LOCATION);
  const [destinationText, setDestinationText] = useState('');
  const [plan, setPlan] = useState<PlannedTrip | null>(null);
  const [selectedTier, setSelectedTier] = useState('uberx');
  const [quoting, setQuoting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<BookingData | null>(null);
  const [rating, setRating] = useState(5);

  const { location, isLocating, locationDenied, locate, camera } = useDeviceLocation();

  const onTripEvent = useCallback((event: TripEvent) => {
    if (event.type === 'STATUS') {
      if (event.status === 'DRIVER_ACCEPTED') notify('Driver on the way', 'Your driver accepted the ride.', 'success');
      if (event.status === 'DRIVER_ARRIVING') notify('Driver has arrived', 'Meet your driver at the pickup point.', 'success');
      if (event.status === 'TRIP_STARTED') notify('Trip started', 'Have a safe journey.', 'success');
      return;
    }
    if (event.status === 'TRIP_COMPLETED') {
      notify('Trip completed', event.booking ? `Fare: ₹${event.booking.fare}` : 'You have arrived.', 'success');
      if (event.booking) setRatingBooking(event.booking);
    } else if (event.status === 'CANCELLED') {
      notify('Ride cancelled', event.booking?.cancellationReason || 'This ride was cancelled.', 'warning');
    } else {
      notify('Ride ended', 'Your ride is no longer active.', 'info');
    }
  }, []);

  const { activeBooking, followBooking, endTrip, driverLiveLoc } = useActiveTrip(onTripEvent);
  const driver = driverPosition(activeBooking, driverLiveLoc);
  const route = useRoadRoute(activeBooking, driver ? [driver.longitude, driver.latitude] : null);
  const tripMap = buildTripMap(activeBooking, driver, route);
  const markers = location
    ? [{ id: 'self-location', latitude: location.latitude, longitude: location.longitude, title: 'You', color: '#00D084' }, ...tripMap.markers]
    : tripMap.markers;

  const resetPlan = () => setPlan(null);

  /** Turns the typed addresses into coordinates and fetches prices. Nothing is guessed. */
  const handleGetPrices = async () => {
    const destinationQuery = destinationText.trim();
    if (!destinationQuery) {
      notify('Where to?', 'Enter a destination to see prices.', 'warning');
      return;
    }
    setQuoting(true);
    try {
      let pickupCoordinates: [number, number];
      let pickupAddress: string;
      const pickupQuery = pickupText.trim();
      if (!pickupQuery || pickupQuery === CURRENT_LOCATION) {
        const here = location ?? (await locate(false));
        if (!here) {
          notify('Location needed', 'Turn on location, or type your pickup address.', 'warning');
          return;
        }
        pickupCoordinates = [here.longitude, here.latitude];
        pickupAddress = CURRENT_LOCATION;
      } else {
        const found = await geocodeAddress(pickupQuery, location);
        if (!found) {
          notify('Pickup not found', `We couldn't find "${pickupQuery}". Try a fuller address.`, 'warning');
          return;
        }
        pickupCoordinates = [found.longitude, found.latitude];
        pickupAddress = pickupQuery;
      }

      const drop = await geocodeAddress(destinationQuery, location);
      if (!drop) {
        notify('Destination not found', `We couldn't find "${destinationQuery}". Try a fuller address.`, 'warning');
        return;
      }
      const dropCoordinates: [number, number] = [drop.longitude, drop.latitude];
      const quotes = await getFareQuotes(pickupCoordinates, dropCoordinates);
      setPlan({ pickupAddress, pickupCoordinates, dropAddress: destinationQuery, dropCoordinates, quotes });
    } catch (cause) {
      const err = formatUnifiedError(cause);
      notify(err.title, err.message, 'error');
    } finally {
      setQuoting(false);
    }
  };

  const handleRequestRide = async () => {
    if (!plan) return;
    setRequesting(true);
    try {
      const booking = await createBooking({
        pickupAddress: plan.pickupAddress,
        pickupCoordinates: plan.pickupCoordinates,
        dropAddress: plan.dropAddress,
        dropCoordinates: plan.dropCoordinates,
        serviceTier: selectedTier,
      });
      followBooking(booking);
      setFormOpen(false);
      setPlan(null);
      setDestinationText('');
    } catch (cause) {
      const err = formatUnifiedError(cause);
      notify(err.title, err.message, 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeBooking) return;
    const ok = await confirmAction('Cancel ride', 'Are you sure you want to cancel this ride?', 'Yes, cancel');
    if (!ok) return;
    try {
      const updated = await updateBookingStatus(activeBooking._id, 'CANCELLED', {
        cancellationReason: 'Cancelled by customer',
      });
      endTrip('CANCELLED', updated);
    } catch (cause) {
      const err = formatUnifiedError(cause);
      notify(err.title, err.message, 'error');
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingBooking) return;
    try {
      await rateBooking(ratingBooking._id, rating);
      setRatingBooking(null);
      notify('Thanks for your feedback', 'Your rating was saved.', 'success');
    } catch (cause) {
      const err = formatUnifiedError(cause);
      notify(err.title, err.message, 'error');
    }
  };

  const driverUser = typeof activeBooking?.driverId === 'object' ? activeBooking.driverId?.userId : undefined;
  const vehicle = typeof activeBooking?.vehicleId === 'object' ? activeBooking.vehicleId : undefined;
  const isSearching = activeBooking?.status === 'REQUESTED' || activeBooking?.status === 'ASSIGNED';
  const routeText = route ? `${route.distanceKm} km • ${route.durationMins} min` : undefined;

  const pillTitle = !activeBooking
    ? ''
    : isSearching
      ? 'Finding a driver near you…'
      : activeBooking.status === 'DRIVER_ACCEPTED'
        ? 'Driver on the way to you'
        : activeBooking.status === 'DRIVER_ARRIVING'
          ? 'Driver is at the pickup point'
          : 'On the way to your destination';

  return (
    <View style={s.container}>
      <NotificationBanner notification={notification} onDismiss={() => setNotification(null)} />

      <View style={s.mapWrapper}>
        <MapView center={camera.center} zoom={camera.zoom} markers={markers} route={tripMap.polyline} style={s.mapFrame} />
        <MapHeader label="BLACKSQUAD" onHistory={() => setHistoryVisible(true)} onProfile={() => setProfileVisible(true)} />
        <RecenterButton isLocating={isLocating} onPress={() => void locate(true)} />
        {activeBooking && <TripPill title={pillTitle} subtitle={isSearching ? undefined : routeText} />}
      </View>

      {activeBooking ? (
        <View style={s.activeRideSheet}>
          <View style={s.sheetHandle} />

          <View style={s.driverCard}>
            <View style={s.driverAvatarBox}>
              {isSearching ? <ActivityIndicator color="#00D084" /> : <Icon name="person" size={22} color="#FFFFFF" />}
            </View>
            <View style={s.driverMeta}>
              <Text style={s.driverName}>{isSearching ? 'Finding a driver' : driverUser?.name || 'Your driver'}</Text>
              <Text style={s.driverVehicle}>
                {isSearching
                  ? `₹${activeBooking.fare} • ${activeBooking.dropAddress}`
                  : [vehicle?.registrationNumber, vehicle?.model].filter(Boolean).join(' • ') || `₹${activeBooking.fare}`}
              </Text>
            </View>
            {activeBooking.startOtp ? (
              <View style={s.otpBadge}>
                <Text style={s.otpLabel}>START PIN</Text>
                <Text style={s.otpCode}>{activeBooking.startOtp}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.tripStatusBox}>
            <View style={s.statusStepRow}>
              <View style={[s.statusDot, { backgroundColor: isSearching ? '#64748B' : '#00D084' }]} />
              <View style={[s.statusLine, { backgroundColor: activeBooking.status === 'TRIP_STARTED' ? '#00D084' : '#334155' }]} />
              <View style={[s.statusDot, { backgroundColor: activeBooking.status === 'TRIP_STARTED' ? '#00D084' : '#334155' }]} />
            </View>
            <View style={s.statusLabelsRow}>
              <Text style={s.stepLabel}>
                {isSearching ? 'Searching' : activeBooking.status === 'DRIVER_ARRIVING' ? 'At pickup' : 'Driver assigned'}
              </Text>
              <Text style={s.stepLabel}>{activeBooking.status === 'TRIP_STARTED' ? 'On the way' : 'Drop-off'}</Text>
            </View>
          </View>

          <View style={s.sheetActions}>
            {driverUser?.phoneNumber ? (
              <Pressable style={s.callBtn} onPress={() => callNumber(driverUser.phoneNumber)}>
                <Icon name="call" size={16} color="#FFFFFF" />
                <Text style={s.callBtnText}>Call driver</Text>
              </Pressable>
            ) : null}
            {activeBooking.status !== 'TRIP_STARTED' && (
              <Pressable style={s.cancelBtn} onPress={() => void handleCancel()}>
                <Icon name="close-circle" size={16} color="#EF4444" />
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View style={s.bookingSheet}>
          <View style={s.sheetHandle} />

          {!formOpen ? (
            <Pressable style={s.searchBar} onPress={() => setFormOpen(true)}>
              <Icon name="search" size={18} color="#00D084" />
              <Text style={s.searchPlaceholder}>Where are you heading today?</Text>
              <View style={s.searchNowBtn}>
                <Text style={s.searchNowText}>RIDE</Text>
              </View>
            </Pressable>
          ) : (
            <ScrollView style={s.bookingFormScroll} showsVerticalScrollIndicator={false}>
              <View style={s.bookingFormHeader}>
                <Text style={s.sheetTitle}>Choose transport</Text>
                <Pressable accessibilityLabel="Close" onPress={() => setFormOpen(false)}>
                  <Icon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={s.inputsContainer}>
                <View style={s.inputRow}>
                  <View style={s.pickupPointDot} />
                  <TextInput
                    style={s.addressInput}
                    value={pickupText}
                    onChangeText={(text) => {
                      setPickupText(text);
                      resetPlan();
                    }}
                    placeholder="Pickup location"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={s.inputDivider} />
                <View style={s.inputRow}>
                  <View style={s.dropPointSquare} />
                  <TextInput
                    style={s.addressInput}
                    value={destinationText}
                    onChangeText={(text) => {
                      setDestinationText(text);
                      resetPlan();
                    }}
                    onSubmitEditing={() => void handleGetPrices()}
                    placeholder="Enter destination"
                    placeholderTextColor="#64748B"
                    autoFocus
                  />
                </View>
              </View>

              {locationDenied && pickupText === CURRENT_LOCATION ? (
                <Text style={s.tierDesc}>Location is off. Turn it on or type your pickup address.</Text>
              ) : null}

              <Text style={s.tiersHeading}>{plan ? `PRICES FOR ${plan.quotes[0]?.distanceKm ?? ''} KM` : 'RIDE OPTIONS'}</Text>
              <View style={s.tiersList}>
                {(plan?.quotes ?? Object.keys(TIER_DETAILS).map((tier) => ({ tier, name: '', fare: 0, distanceKm: 0 }))).map(
                  (quote) => {
                    const details = TIER_DETAILS[quote.tier] ?? { name: quote.tier, desc: '', icon: 'car' };
                    const isSelected = selectedTier === quote.tier;
                    return (
                      <Pressable
                        key={quote.tier}
                        style={[s.tierCard, isSelected && s.tierCardActive]}
                        onPress={() => setSelectedTier(quote.tier)}
                      >
                        <View style={s.tierIconBox}>
                          <Icon name={details.icon} size={22} color={isSelected ? '#00D084' : '#94A3B8'} />
                        </View>
                        <View style={s.tierInfo}>
                          <Text style={s.tierName}>{quote.name || details.name}</Text>
                          <Text style={s.tierDesc}>{details.desc}</Text>
                        </View>
                        <View style={s.tierPricing}>
                          <Text style={s.tierPrice}>{plan ? `₹${quote.fare}` : '—'}</Text>
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </View>

              <View style={s.bookBtnContainer}>
                {plan ? (
                  <AppButton label="Confirm & request ride" loading={requesting} onPress={() => void handleRequestRide()} />
                ) : (
                  <AppButton label="See prices" loading={quoting} onPress={() => void handleGetPrices()} />
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      <Modal visible={Boolean(ratingBooking)} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.ratingCard}>
            <View style={s.ratingHeader}>
              <Icon name="checkmark-circle" size={40} color="#00D084" />
              <Text style={s.ratingTitle}>Rate your driver</Text>
              <Text style={s.ratingSub}>How was your ride?</Text>
            </View>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} accessibilityLabel={`${star} stars`} onPress={() => setRating(star)} style={s.starBtn}>
                  <Icon name={star <= rating ? 'star' : 'star-outline'} size={28} color="#F59E0B" />
                </Pressable>
              ))}
            </View>
            <AppButton label="Submit rating" onPress={() => void handleSubmitRating()} />
            <Pressable onPress={() => setRatingBooking(null)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={s.ratingSub}>Skip</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} onLogout={onLogout} role="CUSTOMER" />
      <TripHistoryModal visible={historyVisible} role="CUSTOMER" onClose={() => setHistoryVisible(false)} />
    </View>
  );
}
