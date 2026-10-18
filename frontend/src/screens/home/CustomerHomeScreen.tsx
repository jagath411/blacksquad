import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { MapView } from '../../components/MapView';
import { NotificationBanner, type NotificationItem } from '../../components/NotificationBanner';
import { ProfileModal } from '../../components/ProfileModal';
import { TripHistoryModal } from '../../components/TripHistoryModal';
import { Icon } from '../../components/ui/Icon';
import { useActiveTrip, type TripEvent } from '../../hooks/useActiveTrip';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRoadRoute } from '../../hooks/useRoadRoute';
import { getCurrentUser, type SavedPlace } from '../../services/authService';
import { createBooking, getBookingHistory, getFareQuotes, rateBooking, updateBookingStatus, type FareQuote } from '../../services/bookingService';
import { geocodeAddress, type PlaceSuggestion } from '../../services/geocodingService';
import { usePlaceSuggestions } from '../../hooks/usePlaceSuggestions';
import type { BookingData } from '../../types';
import { callNumber, confirmAction } from '../../utils/dialogs';
import { formatUnifiedError } from '../../utils/errorHandler';
import { MapHeader, NumberPlate, RecenterButton, TripPill, TripSteps } from './MapChrome';
import { haptic } from '../../utils/haptics';
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

/** A place the rider picked from a list, so its exact coordinates are known without another lookup. */
interface PickedPlace {
  address: string;
  coordinates: [number, number];
  label?: string;
}

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
  const [pickedDrop, setPickedDrop] = useState<PickedPlace | null>(null);
  const [pickedPickup, setPickedPickup] = useState<PickedPlace | null>(null);
  const [focusedField, setFocusedField] = useState<'pickup' | 'drop' | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<PickedPlace[]>([]);
  const [selectedTier, setSelectedTier] = useState('uberx');
  const [quoting, setQuoting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<BookingData | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [contact, setContact] = useState<{ name?: string; phoneNumber: string } | null>(null);
  const [rating, setRating] = useState(5);

  const { location, isLocating, locationDenied, locate, camera } = useDeviceLocation();

  const onTripEvent = useCallback((event: TripEvent) => {
    if (event.type === 'STATUS') {
      if (event.status === 'DRIVER_ACCEPTED') haptic.success();
      if (event.status === 'DRIVER_ARRIVING') haptic.warning();
      if (event.status === 'DRIVER_ACCEPTED') notify('Driver on the way', 'Your driver accepted the ride.', 'success');
      if (event.status === 'DRIVER_ARRIVING') notify('Driver has arrived', 'Meet your driver at the pickup point.', 'success');
      if (event.status === 'TRIP_STARTED') notify('Trip started', 'Have a safe journey.', 'success');
      return;
    }
    if (event.status === 'TRIP_COMPLETED') {
      haptic.success();
      notify('Trip completed', event.booking ? `Fare: ₹${event.booking.fare}` : 'You have arrived.', 'success');
      if (event.booking) setRatingBooking(event.booking);
    } else if (event.status === 'CANCELLED') {
      notify('Ride cancelled', event.booking?.cancellationReason || 'This ride was cancelled.', 'warning');
    } else {
      notify('Ride ended', 'Your ride is no longer active.', 'info');
    }
  }, []);

  const { activeBooking, followBooking, endTrip, driverLiveLoc } = useActiveTrip(onTripEvent);
  const activeBookingId = activeBooking?._id;

  // Saved places and the emergency contact come from the profile; refresh whenever the booking form opens.
  useEffect(() => {
    if (!formOpen && !activeBookingId) return;
    getCurrentUser()
      .then((u) => {
        setSavedPlaces(u.savedPlaces ?? []);
        setContact(u.emergencyContact ?? null);
      })
      .catch(() => undefined);
    if (formOpen) {
      // Recent destinations: the last three distinct drop-offs from trip history.
      getBookingHistory()
        .then((trips) => {
          const seen = new Set<string>();
          const recent: PickedPlace[] = [];
          for (const trip of trips) {
            if (seen.has(trip.dropAddress) || !trip.dropLocation?.coordinates) continue;
            seen.add(trip.dropAddress);
            recent.push({ address: trip.dropAddress, coordinates: trip.dropLocation.coordinates });
            if (recent.length === 3) break;
          }
          setRecentPlaces(recent);
        })
        .catch(() => undefined);
    }
  }, [formOpen, activeBookingId]);

  const driver = driverPosition(activeBooking, driverLiveLoc);
  const route = useRoadRoute(activeBooking, driver ? [driver.longitude, driver.latitude] : null);
  const tripMap = buildTripMap(activeBooking, driver, route);
  const markers = location
    ? [{ id: 'self-location', latitude: location.latitude, longitude: location.longitude, title: 'You', color: '#2457D6' }, ...tripMap.markers]
    : tripMap.markers;

  const resetPlan = () => setPlan(null);

  const suggestionQuery =
    focusedField === 'pickup' ? (pickupText === CURRENT_LOCATION ? '' : pickupText) : focusedField === 'drop' ? destinationText : '';
  // Without GPS, rank results around the area the map is showing.
  const { suggestions, loading: searching } = usePlaceSuggestions(suggestionQuery, location ?? camera.center);

  /** Fills a field from the list. Picking the destination fetches prices straight away. */
  const choosePlace = (place: PickedPlace | 'current') => {
    resetPlan();
    if (focusedField === 'pickup') {
      if (place === 'current') {
        setPickupText(CURRENT_LOCATION);
        setPickedPickup(null);
      } else {
        setPickupText(place.address);
        setPickedPickup(place);
      }
      setFocusedField('drop');
      return;
    }
    if (place === 'current') return;
    setDestinationText(place.address);
    setPickedDrop(place);
    setFocusedField(null);
    void handleGetPrices({ drop: place });
  };

  /** Turns the typed addresses into coordinates and fetches prices. Nothing is guessed. */
  const handleGetPrices = async (override?: { drop?: PickedPlace; pickup?: PickedPlace }) => {
    const chosenDrop = override?.drop ?? pickedDrop;
    const chosenPickup = override?.pickup ?? pickedPickup;
    const destinationQuery = (override?.drop?.address ?? destinationText).trim();
    if (!destinationQuery) {
      notify('Where to?', 'Enter a destination to see prices.', 'warning');
      return;
    }
    setQuoting(true);
    try {
      let pickupCoordinates: [number, number];
      let pickupAddress: string;
      const pickupQuery = (override?.pickup?.address ?? pickupText).trim();
      if (chosenPickup && chosenPickup.address === pickupQuery) {
        pickupCoordinates = chosenPickup.coordinates;
        pickupAddress = chosenPickup.address;
      } else if (!pickupQuery || pickupQuery === CURRENT_LOCATION) {
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

      const drop =
        chosenDrop && chosenDrop.address === destinationQuery
          ? { longitude: chosenDrop.coordinates[0], latitude: chosenDrop.coordinates[1] }
          : await geocodeAddress(destinationQuery, location);
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
      haptic.press();
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

  /** Shares who is driving, the car and where the rider is going, e.g. with their emergency contact. */
  const shareTrip = async () => {
    if (!activeBooking) return;
    const lines = [
      `I'm on a BlackSquad ride to ${activeBooking.dropAddress}.`,
      driverUser?.name ? `Driver: ${driverUser.name}${driverUser.phoneNumber ? ` (${driverUser.phoneNumber})` : ''}` : '',
      vehicle?.registrationNumber ? `Vehicle: ${vehicle.registrationNumber}${vehicle.model ? `, ${vehicle.model}` : ''}` : '',
    ].filter(Boolean);
    const message = lines.join('\n');
    try {
      await Share.share({ message, title: 'My trip' });
    } catch {
      if (contact) callNumber(contact.phoneNumber);
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
        <MapHeader label="BlackSquad" onHistory={() => setHistoryVisible(true)} onProfile={() => setProfileVisible(true)} />
        <RecenterButton isLocating={isLocating} onPress={() => void locate(true)} />
        {activeBooking && <TripPill title={pillTitle} subtitle={isSearching ? undefined : routeText} />}
      </View>

      {activeBooking ? (
        <View style={s.activeRideSheet}>
          <View style={s.sheetHandle} />

          <View style={s.driverCard}>
            <View style={s.driverAvatarBox}>
              {isSearching ? <ActivityIndicator color="#1D232B" /> : <Icon name="person" size={22} color="#1D232B" />}
            </View>
            <View style={s.driverMeta}>
              <Text style={s.driverName}>{isSearching ? 'Finding a driver' : driverUser?.name || 'Your driver'}</Text>
              <Text style={s.driverVehicle}>
                ₹{activeBooking.fare} to {activeBooking.dropAddress}
              </Text>
            </View>
            {activeBooking.startOtp ? <NumberPlate caption="Trip PIN" text={activeBooking.startOtp} /> : null}
          </View>
          {!isSearching && vehicle?.registrationNumber ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <NumberPlate text={vehicle.registrationNumber} />
              {vehicle.model ? <Text style={s.driverVehicle}>{vehicle.model}</Text> : null}
            </View>
          ) : null}

          {isSearching ? (
            <Text style={[s.tierDesc, { marginBottom: 16 }]}>
              We&apos;re asking drivers near you. This usually takes under a minute.
            </Text>
          ) : (
            <TripSteps status={activeBooking.status} />
          )}

          <View style={s.sheetActions}>
            {driverUser?.phoneNumber ? (
              <Pressable accessibilityRole="button" style={s.callBtn} onPress={() => callNumber(driverUser.phoneNumber)}>
                <Icon name="call" size={18} color="#FFFFFF" />
                <Text style={s.callBtnText}>Call driver</Text>
              </Pressable>
            ) : null}
            {!isSearching ? (
              <Pressable accessibilityRole="button" style={s.cancelBtn} onPress={() => void shareTrip()}>
                <Icon name="share-social" size={18} color="#1D232B" />
                <Text style={[s.cancelBtnText, { color: '#1D232B' }]}>Share trip</Text>
              </Pressable>
            ) : null}
            {activeBooking.status !== 'TRIP_STARTED' && (
              <Pressable accessibilityRole="button" style={s.cancelBtn} onPress={() => void handleCancel()}>
                <Icon name="close-circle" size={16} color="#C8372D" />
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View style={s.bookingSheet}>
          <View style={s.sheetHandle} />

          {!formOpen ? (
            <Pressable accessibilityRole="button" style={s.searchBar} onPress={() => setFormOpen(true)}>
              <Icon name="search" size={20} color="#1D232B" />
              <Text style={s.searchPlaceholder}>Where to?</Text>
            </Pressable>
          ) : (
            <ScrollView style={s.bookingFormScroll} showsVerticalScrollIndicator={false}>
              <View style={s.bookingFormHeader}>
                <Text style={s.sheetTitle}>Plan your ride</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setFormOpen(false)}>
                  <Icon name="close" size={20} color="#5B6573" />
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
                      setPickedPickup(null);
                      resetPlan();
                    }}
                    onFocus={() => setFocusedField('pickup')}
                    selectTextOnFocus
                    placeholder="Pickup location"
                    placeholderTextColor="#7A8592"
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
                      setPickedDrop(null);
                      resetPlan();
                    }}
                    onFocus={() => setFocusedField('drop')}
                    onSubmitEditing={() => void handleGetPrices()}
                    placeholder="Enter destination"
                    placeholderTextColor="#7A8592"
                    autoFocus
                  />
                </View>
              </View>

              {focusedField && !plan ? (
                <View style={s.suggestionList} accessibilityRole="list">
                  {suggestionQuery.trim().length >= 3 ? (
                    <>
                      {suggestions.map((place) => (
                        <SuggestionRow
                          key={`${place.coordinates.join(',')}-${place.title}`}
                          icon="location-outline"
                          title={place.title}
                          subtitle={place.subtitle}
                          onPress={() => choosePlace(toPicked(place))}
                        />
                      ))}
                      {searching ? <ActivityIndicator color="#1F3FB8" style={{ paddingVertical: 14 }} /> : null}
                      {!searching && suggestions.length === 0 ? (
                        <Text style={s.suggestionEmpty}>No matches yet. Try adding the area or city.</Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {focusedField === 'pickup' ? (
                        <SuggestionRow icon="navigate" title="Current location" subtitle="Use where you are now" onPress={() => choosePlace('current')} />
                      ) : null}
                      {savedPlaces.map((place) => (
                        <SuggestionRow
                          key={`saved-${place.label}-${place.address}`}
                          icon={place.label.toLowerCase() === 'home' ? 'home' : place.label.toLowerCase() === 'work' ? 'briefcase' : 'bookmark'}
                          title={place.label}
                          subtitle={place.address}
                          onPress={() => choosePlace(place)}
                        />
                      ))}
                      {recentPlaces.map((place) => (
                        <SuggestionRow
                          key={`recent-${place.address}`}
                          icon="time-outline"
                          title={place.address.split(',')[0] ?? place.address}
                          subtitle={place.address}
                          onPress={() => choosePlace(place)}
                        />
                      ))}
                      {savedPlaces.length === 0 && recentPlaces.length === 0 && focusedField === 'drop' ? (
                        <Text style={s.suggestionEmpty}>Start typing a place, street or landmark.</Text>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}

              {locationDenied && pickupText === CURRENT_LOCATION ? (
                <Text style={[s.tierDesc, { marginTop: 10, color: '#B7791F' }]}>Location is off. Turn it on or type your pickup address.</Text>
              ) : null}

              {focusedField && !plan ? null : (
              <>
              <Text style={s.tiersHeading}>{plan ? `Prices for ${plan.quotes[0]?.distanceKm ?? ''} km` : 'Ride options'}</Text>
              <View style={s.tiersList}>
                {(plan?.quotes ?? Object.keys(TIER_DETAILS).map((tier) => ({ tier, name: '', fare: 0, distanceKm: 0 }))).map(
                  (quote) => {
                    const details = TIER_DETAILS[quote.tier] ?? { name: quote.tier, desc: '', icon: 'car' };
                    const isSelected = selectedTier === quote.tier;
                    return (
                      <Pressable accessibilityRole="button"
                        key={quote.tier}
                        style={[s.tierCard, isSelected && s.tierCardActive]}
                        onPress={() => setSelectedTier(quote.tier)}
                      >
                        <View style={s.tierIconBox}>
                          <Icon name={details.icon} size={22} color={isSelected ? '#1D232B' : '#5B6573'} />
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
                  <AppButton
                    label={`Request ${TIER_DETAILS[selectedTier]?.name ?? 'ride'} · ₹${plan.quotes.find((q) => q.tier === selectedTier)?.fare ?? ''}`}
                    loading={requesting}
                    onPress={() => void handleRequestRide()}
                  />
                ) : (
                  <AppButton label="See prices" loading={quoting} onPress={() => void handleGetPrices()} />
                )}
              </View>
              </>
              )}
            </ScrollView>
          )}
        </View>
      )}

      <Modal visible={Boolean(ratingBooking)} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.ratingCard}>
            <View style={s.ratingHeader}>
              <Icon name="checkmark-circle" size={44} color="#1E8E5A" />
              <Text style={s.ratingTitle}>Rate your driver</Text>
              <Text style={s.ratingSub}>How was your ride?</Text>
            </View>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable accessibilityRole="button" key={star} accessibilityLabel={`${star} stars`} onPress={() => setRating(star)} style={s.starBtn}>
                  <Icon name={star <= rating ? 'star' : 'star-outline'} size={28} color="#B7791F" />
                </Pressable>
              ))}
            </View>
            <AppButton label="Submit rating" onPress={() => void handleSubmitRating()} />
            <Pressable accessibilityRole="button" onPress={() => setRatingBooking(null)} style={{ marginTop: 12, alignItems: 'center' }}>
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

const toPicked = (place: PlaceSuggestion): PickedPlace => ({ address: place.address, coordinates: place.coordinates });

function SuggestionRow({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [s.suggestionRow, pressed && { backgroundColor: '#EEF2FD' }]}
    >
      <View style={s.suggestionIcon}>
        <Icon name={icon} size={18} color="#1D232B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.suggestionTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.suggestionSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
