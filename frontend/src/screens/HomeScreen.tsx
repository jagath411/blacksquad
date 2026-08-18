import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { MapView, type MapMarker, type RoutePolyline } from '../components/MapView';
import { ProfileModal } from '../components/ProfileModal';
import { DriverDetailModal } from '../components/DriverDetailModal';
import { NotificationBanner, type NotificationItem } from '../components/NotificationBanner';
import { Icon } from '../components/ui/Icon';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';
import type { BookingData, BookingStatus, DriverLiveLocation, RootStackParamList, UserRole } from '../types';
import {
  createFleetSocket,
  joinBookingRoom,
  leaveBookingRoom,
  onBookingLocationUpdate,
  onBookingStatusChange,
  onNewBookingRequest,
  setDriverDutyStatus,
  type FleetSocket,
} from '../services/socket';
import { startDriverTracking, type TrackerStatus } from '../services/driverTracker';
import { useFleet, type FleetDriver } from '../hooks/useFleet';
import { clearAllStorage } from '../services/tokenStore';
import {
  acceptBooking,
  createBooking,
  getActiveBooking,
  rateBooking,
  updateBookingStatus,
} from '../services/bookingService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface RideTier {
  id: string;
  name: string;
  eta: string;
  price: string;
  fareNumber: number;
  desc: string;
  icon: string;
  iconFamily: 'ionicons' | 'material' | 'feather';
}

const RIDE_TIERS: RideTier[] = [
  {
    id: 'uberx',
    name: 'BlackSquad Express',
    eta: '3 mins away',
    price: '₹280',
    fareNumber: 280,
    desc: 'Fast, comfortable city sedan',
    icon: 'car-sport',
    iconFamily: 'ionicons',
  },
  {
    id: 'comfort',
    name: 'Fleet Comfort Van',
    eta: '5 mins away',
    price: '₹450',
    fareNumber: 450,
    desc: 'Extra space for groups & cargo',
    icon: 'bus',
    iconFamily: 'ionicons',
  },
  {
    id: 'heavy',
    name: 'Heavy Freight Hauler',
    eta: '8 mins away',
    price: '₹950',
    fareNumber: 950,
    desc: 'Commercial logistics transport',
    icon: 'cube',
    iconFamily: 'ionicons',
  },
];

export function HomeScreen({ route, navigation }: Props) {
  const role: UserRole = route.params.role;
  const [profileVisible, setProfileVisible] = useState(false);
  const [pickup, setPickup] = useState('BLR Tech Park, Bellandur');
  const [destination, setDestination] = useState('');
  const [selectedTier, setSelectedTier] = useState('uberx');
  const [bookingModal, setBookingModal] = useState(false);
  const [activeBooking, setActiveBooking] = useState<BookingData | null>(null);
  const [notification, setNotification] = useState<NotificationItem | null>(null);

  // Live Tracking States
  const [driverLiveLoc, setDriverLiveLoc] = useState<DriverLiveLocation | null>(null);
  const [incomingBookingReq, setIncomingBookingReq] = useState<BookingData | null>(null);
  const [incomingTimer, setIncomingTimer] = useState(15);
  const [otpInput, setOtpInput] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);

  // Map & Camera
  const [mapCenter, setMapCenter] = useState({ latitude: 12.9716, longitude: 77.5946 });
  const [mapZoom, setMapZoom] = useState(13);

  // Driver duty & Fleet
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('offline');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const { fleet } = useFleet();

  const socketRef = useRef<FleetSocket | null>(null);
  const trackerCleanupRef = useRef<(() => void) | null>(null);

  // Initialize Socket and fetch Active Booking
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const socket = await createFleetSocket();
        if (!isMounted) return;
        socketRef.current = socket;

        // Fetch any existing active booking
        const existing = await getActiveBooking();
        if (isMounted && existing) {
          setActiveBooking(existing);
          joinBookingRoom(socket, existing._id);
          if (existing.pickupLocation?.coordinates) {
            setMapCenter({
              latitude: existing.pickupLocation.coordinates[1],
              longitude: existing.pickupLocation.coordinates[0],
            });
          }
        }

        // Listen for Real-Time Live Driver Coordinates
        const unsubscribeLocation = onBookingLocationUpdate(socket, (loc) => {
          setDriverLiveLoc(loc);
          setMapCenter({ latitude: loc.latitude, longitude: loc.longitude });
        });

        // Listen for Real-Time Booking Status Changes
        const unsubscribeStatus = onBookingStatusChange(socket, (payload) => {
          if (payload.booking) {
            setActiveBooking(payload.booking);
          }
          if (payload.status === 'DRIVER_ACCEPTED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Driver Accepted Your Ride',
              body: 'Your driver is en route to pickup.',
            });
          } else if (payload.status === 'DRIVER_ARRIVING') {
            setNotification({
              id: Date.now().toString(),
              title: 'Driver Has Arrived',
              body: 'Please meet your driver at the pickup location.',
            });
          } else if (payload.status === 'TRIP_STARTED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Trip Started',
              body: 'Sit back and relax. Enjoy your ride!',
            });
          } else if (payload.status === 'TRIP_COMPLETED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Trip Completed',
              body: 'Thank you for riding with BlackSquad.',
            });
            setShowRatingModal(true);
          }
        });

        // Listen for Incoming Requests for Online Drivers
        const unsubscribeRequests = onNewBookingRequest(socket, (req) => {
          if (role === 'DRIVER' && isDriverOnline) {
            setIncomingBookingReq(req);
            setIncomingTimer(15);
          }
        });

        return () => {
          unsubscribeLocation();
          unsubscribeStatus();
          unsubscribeRequests();
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log('Socket initialization error:', err);
      }
    }

    const cleanupPromise = init();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [role, isDriverOnline]);

  // Driver Request Countdown Timer
  useEffect(() => {
    if (!incomingBookingReq) return;
    const interval = setInterval(() => {
      setIncomingTimer((prev) => {
        if (prev <= 1) {
          setIncomingBookingReq(null);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [incomingBookingReq]);

  // Periodic fallback check for active booking
  useEffect(() => {
    const interval = setInterval(() => {
      getActiveBooking()
        .then((b) => {
          if (b && (!activeBooking || b.status !== activeBooking.status)) {
            setActiveBooking(b);
            if (socketRef.current) {
              joinBookingRoom(socketRef.current, b._id);
            }
          }
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, [activeBooking]);

  const handleLogout = async () => {
    if (socketRef.current && activeBooking) {
      leaveBookingRoom(socketRef.current, activeBooking._id);
    }
    if (trackerCleanupRef.current) {
      trackerCleanupRef.current();
    }
    await clearAllStorage();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Role' }],
    });
  };

  // Request / Book Ride
  const handleRequestRide = async () => {
    if (!destination.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a destination');
      else Alert.alert('Destination Required', 'Please enter where you want to go.');
      return;
    }

    const selectedTierObj = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];

    try {
      const newBooking = await createBooking({
        pickupAddress: pickup,
        pickupCoordinates: [77.5946, 12.9716],
        dropAddress: destination,
        dropCoordinates: [77.6389, 12.9141],
        fare: selectedTierObj.fareNumber,
        serviceTier: selectedTierObj.name,
      });

      setActiveBooking(newBooking);
      setBookingModal(false);

      if (socketRef.current) {
        joinBookingRoom(socketRef.current, newBooking._id);
      }
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message || 'Failed to book ride');
      else Alert.alert('Booking Error', e.message || 'Could not request ride');
    }
  };

  // DRIVER: Toggle Duty
  const handleToggleDuty = async () => {
    if (isDriverOnline) {
      if (trackerCleanupRef.current) {
        trackerCleanupRef.current();
        trackerCleanupRef.current = null;
      }
      setIsDriverOnline(false);
      setTrackerStatus('offline');
      if (socketRef.current) {
        setDriverDutyStatus(socketRef.current, 'OFFLINE');
      }
    } else {
      try {
        if (socketRef.current) {
          setDriverDutyStatus(socketRef.current, 'AVAILABLE');
          const cleanup = await startDriverTracking(socketRef.current, (st) =>
            setTrackerStatus(st),
          );
          trackerCleanupRef.current = cleanup;
          setIsDriverOnline(true);
        }
      } catch (err: any) {
        if (Platform.OS === 'web') window.alert(err.message || 'Failed to start GPS tracking');
      }
    }
  };

  // DRIVER: Accept Ride
  const handleAcceptRide = async (bookingId: string) => {
    try {
      const updated = await acceptBooking(bookingId);
      setActiveBooking(updated);
      setIncomingBookingReq(null);
      if (socketRef.current) {
        joinBookingRoom(socketRef.current, bookingId);
      }
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message || 'Failed to accept ride');
    }
  };

  // DRIVER: Status Updates
  const handleDriverStatusUpdate = async (status: BookingStatus) => {
    if (!activeBooking) return;
    try {
      if (status === 'TRIP_STARTED') {
        setShowOtpModal(true);
        return;
      }

      const updated = await updateBookingStatus(activeBooking._id, status);
      setActiveBooking(updated);
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message || 'Failed to update status');
    }
  };

  // DRIVER: Verify OTP and start trip
  const handleVerifyOtpAndStart = async () => {
    if (!activeBooking || !otpInput.trim()) return;
    try {
      const updated = await updateBookingStatus(activeBooking._id, 'TRIP_STARTED', {
        otp: otpInput.trim(),
      });
      setActiveBooking(updated);
      setShowOtpModal(false);
      setOtpInput('');
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message || 'Invalid Ride Start PIN');
    }
  };

  // Submit Rating
  const handleSubmitRating = async () => {
    if (activeBooking) {
      try {
        await rateBooking(activeBooking._id, userRating);
      } catch {}
    }
    setShowRatingModal(false);
    setActiveBooking(null);
    setBookingModal(false);
    setDestination('');
  };

  // Cancel Booking
  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    try {
      await updateBookingStatus(activeBooking._id, 'CANCELLED', {
        cancellationReason: 'Rider requested cancellation',
      });
      setActiveBooking(null);
      setBookingModal(false);
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message || 'Failed to cancel booking');
    }
  };

  // Compute Map Markers
  const markers: MapMarker[] = [];
  let routePolyline: RoutePolyline | undefined;

  if (activeBooking) {
    // Pickup Pin
    if (activeBooking.pickupLocation?.coordinates) {
      markers.push({
        id: 'pickup',
        longitude: activeBooking.pickupLocation.coordinates[0],
        latitude: activeBooking.pickupLocation.coordinates[1],
        title: `Pickup: ${activeBooking.pickupAddress}`,
        color: '#00D084',
      });
    }

    // Drop Pin
    if (activeBooking.dropLocation?.coordinates) {
      markers.push({
        id: 'drop',
        longitude: activeBooking.dropLocation.coordinates[0],
        latitude: activeBooking.dropLocation.coordinates[1],
        title: `Destination: ${activeBooking.dropAddress}`,
        color: '#EF4444',
      });
    }

    // Driver Live Location
    const dLat = driverLiveLoc?.latitude || activeBooking.driverLocation?.latitude;
    const dLon = driverLiveLoc?.longitude || activeBooking.driverLocation?.longitude;
    const dHeading = driverLiveLoc?.heading || activeBooking.driverLocation?.heading || 0;

    if (dLat && dLon) {
      markers.push({
        id: 'driver',
        latitude: dLat,
        longitude: dLon,
        title: 'Driver Live Location',
        color: '#0F172A',
        heading: dHeading,
        isVehicle: true,
      });

      // Draw polyline connecting Driver -> Target
      if (activeBooking.pickupLocation?.coordinates && activeBooking.dropLocation?.coordinates) {
        if (activeBooking.status === 'TRIP_STARTED') {
          routePolyline = {
            coordinates: [
              [dLon, dLat],
              activeBooking.dropLocation.coordinates,
            ],
            color: '#38BDF8',
          };
        } else {
          routePolyline = {
            coordinates: [
              [dLon, dLat],
              activeBooking.pickupLocation.coordinates,
              activeBooking.dropLocation.coordinates,
            ],
            color: '#00D084',
          };
        }
      }
    }
  } else if (role === 'OWNER') {
    fleet.forEach((d: FleetDriver) => {
      markers.push({
        id: d.driverId,
        latitude: d.latitude,
        longitude: d.longitude,
        title: `${d.driverName || 'Driver'}`,
        color: d.connection === 'online' ? '#00D084' : '#64748B',
        isVehicle: true,
      });
    });
  }

  // Profile modal instance
  const profileModalElement = (
    <ProfileModal
      visible={profileVisible}
      role={role}
      onClose={() => setProfileVisible(false)}
      onLogout={handleLogout}
    />
  );

  // ==========================================
  // 1. RIDER / CUSTOMER WORKSPACE
  // ==========================================
  if (role === 'CUSTOMER') {
    return (
      <View style={s.customerRoot}>
        {notification && (
          <NotificationBanner
            notification={notification}
            onDismiss={() => setNotification(null)}
          />
        )}

        {/* Map View */}
        <View style={s.mapSurface}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            route={routePolyline}
            style={s.mapFrame}
          />

          {/* Top Floating Bar */}
          <View style={s.mapTopRow}>
            <View style={s.brandBadge}>
              <Icon name="flash" size={14} color="#00D084" />
              <Text style={s.brandBadgeText}>BLACKSQUAD</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              style={s.profileAvatarBtn}
              onPress={() => setProfileVisible(true)}
            >
              <Icon name="person" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Live ETA Floating Pill during active ride */}
          {activeBooking && (
            <View style={s.floatingEtaPill}>
              <Icon name="navigate" size={14} color="#00D084" />
              <Text style={s.floatingEtaText}>
                {activeBooking.status === 'REQUESTED'
                  ? 'Finding nearest verified driver...'
                  : activeBooking.status === 'DRIVER_ACCEPTED'
                  ? `Driver en route • ${driverLiveLoc?.etaMinutes || 4} mins ETA`
                  : activeBooking.status === 'DRIVER_ARRIVING'
                  ? 'Driver has arrived at pickup point'
                  : activeBooking.status === 'TRIP_STARTED'
                  ? `En route to destination • ₹${activeBooking.fare}`
                  : 'Trip in progress'}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Sheet: Active Tracking vs Booking Creator */}
        {activeBooking ? (
          <View style={s.activeRideSheet}>
            <View style={s.sheetHandle} />

            {/* Driver & Vehicle Header Card */}
            <View style={s.driverCard}>
              <View style={s.driverAvatarBox}>
                <Icon name="person" size={22} color="#FFFFFF" />
              </View>
              <View style={s.driverMeta}>
                <Text style={s.driverName}>
                  {typeof activeBooking.driverId === 'object' &&
                  activeBooking.driverId?.userId?.name
                    ? activeBooking.driverId.userId.name
                    : 'Assigned Driver'}
                </Text>
                <Text style={s.driverVehicle}>
                  {activeBooking.serviceTier || 'Express'} •{' '}
                  {activeBooking.driverLocation?.speed
                    ? `${Math.round(activeBooking.driverLocation.speed)} km/h`
                    : 'Active GPS'}
                </Text>
              </View>
              <View style={s.otpBadge}>
                <Text style={s.otpLabel}>START PIN</Text>
                <Text style={s.otpCode}>{activeBooking.startOtp || '4829'}</Text>
              </View>
            </View>

            {/* Route Status Progress Indicator */}
            <View style={s.tripStatusBox}>
              <View style={s.statusStepRow}>
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor:
                        activeBooking.status !== 'REQUESTED' ? '#00D084' : '#64748B',
                    },
                  ]}
                />
                <View
                  style={[
                    s.statusLine,
                    {
                      backgroundColor:
                        activeBooking.status === 'TRIP_STARTED' ? '#00D084' : '#334155',
                    },
                  ]}
                />
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor:
                        activeBooking.status === 'TRIP_STARTED' ? '#00D084' : '#334155',
                    },
                  ]}
                />
              </View>

              <View style={s.statusLabelsRow}>
                <Text style={s.stepLabel}>
                  {activeBooking.status === 'DRIVER_ACCEPTED'
                    ? 'Driver Dispatched'
                    : activeBooking.status === 'DRIVER_ARRIVING'
                    ? 'At Pickup Spot'
                    : 'Driver En Route'}
                </Text>
                <Text style={s.stepLabel}>
                  {activeBooking.status === 'TRIP_STARTED' ? 'Driving to Destination' : 'Dropoff'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={s.sheetActions}>
              <Pressable
                style={s.callBtn}
                onPress={() => {
                  if (Platform.OS === 'web') window.alert('Calling driver: +91 98765 43210');
                  else Alert.alert('Contact Driver', 'Dialing +91 98765 43210');
                }}
              >
                <Icon name="call" size={16} color="#FFFFFF" />
                <Text style={s.callBtnText}>Call Driver</Text>
              </Pressable>

              <Pressable
                style={s.cancelBtn}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (window.confirm('Cancel this active ride?')) handleCancelBooking();
                  } else {
                    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes, Cancel', style: 'destructive', onPress: handleCancelBooking },
                    ]);
                  }
                }}
              >
                <Icon name="close-circle" size={16} color="#EF4444" />
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={s.bookingSheet}>
            <View style={s.sheetHandle} />

            {/* Search destination trigger bar */}
            {!bookingModal ? (
              <Pressable style={s.searchBar} onPress={() => setBookingModal(true)}>
                <Icon name="search" size={18} color="#00D084" />
                <Text style={s.searchPlaceholder}>Where are you heading today?</Text>
                <View style={s.searchNowBtn}>
                  <Text style={s.searchNowText}>RIDE</Text>
                </View>
              </Pressable>
            ) : (
              <ScrollView style={s.bookingFormScroll} showsVerticalScrollIndicator={false}>
                <View style={s.bookingFormHeader}>
                  <Text style={s.sheetTitle}>Choose Transport</Text>
                  <Pressable onPress={() => setBookingModal(false)}>
                    <Icon name="close" size={20} color="#94A3B8" />
                  </Pressable>
                </View>

                {/* Pickup & Destination Inputs */}
                <View style={s.inputsContainer}>
                  <View style={s.inputRow}>
                    <View style={s.pickupPointDot} />
                    <TextInput
                      style={s.addressInput}
                      value={pickup}
                      onChangeText={setPickup}
                      placeholder="Pickup location"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={s.inputDivider} />
                  <View style={s.inputRow}>
                    <View style={s.dropPointSquare} />
                    <TextInput
                      style={s.addressInput}
                      value={destination}
                      onChangeText={setDestination}
                      placeholder="Enter destination"
                      placeholderTextColor="#64748B"
                      autoFocus
                    />
                  </View>
                </View>

                {/* Vehicle Selection Tiers */}
                <Text style={s.tiersHeading}>RECOMMENDED RIDES</Text>
                <View style={s.tiersList}>
                  {RIDE_TIERS.map((tier) => {
                    const isSelected = selectedTier === tier.id;
                    return (
                      <Pressable
                        key={tier.id}
                        style={[s.tierCard, isSelected && s.tierCardActive]}
                        onPress={() => setSelectedTier(tier.id)}
                      >
                        <View style={[s.tierIconBox, isSelected && s.tierIconBoxActive]}>
                          <Icon
                            name={tier.icon}
                            family={tier.iconFamily}
                            size={22}
                            color={isSelected ? '#00D084' : '#94A3B8'}
                          />
                        </View>
                        <View style={s.tierInfo}>
                          <Text style={s.tierName}>{tier.name}</Text>
                          <Text style={s.tierMeta}>
                            {tier.eta} • {tier.desc}
                          </Text>
                        </View>
                        <Text style={s.tierPrice}>{tier.price}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Confirm Booking CTA */}
                <View style={s.requestBtnBox}>
                  <AppButton
                    label={`Confirm ${
                      RIDE_TIERS.find((t) => t.id === selectedTier)?.name || 'Express'
                    }`}
                    onPress={handleRequestRide}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* Rating & Review Post-Trip Modal */}
        <Modal visible={showRatingModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.ratingCard}>
              <View style={s.ratingIconBox}>
                <Icon name="checkmark-circle" size={40} color="#00D084" />
              </View>
              <Text style={s.ratingTitle}>Trip Complete</Text>
              <Text style={s.ratingSub}>How was your experience with BlackSquad?</Text>

              {/* Vector Star Rating */}
              <View style={s.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setUserRating(star)}>
                    <Icon
                      name={star <= userRating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= userRating ? '#FACC15' : '#334155'}
                    />
                  </Pressable>
                ))}
              </View>

              {/* Tip Selection */}
              <Text style={s.tipHeading}>ADD A DRIVER TIP</Text>
              <View style={s.tipRow}>
                {[0, 20, 50, 100].map((amount) => (
                  <Pressable
                    key={amount}
                    style={[s.tipPill, tipAmount === amount && s.tipPillActive]}
                    onPress={() => setTipAmount(amount)}
                  >
                    <Text style={[s.tipText, tipAmount === amount && s.tipTextActive]}>
                      {amount === 0 ? 'No tip' : `₹${amount}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AppButton label="Submit Feedback" onPress={handleSubmitRating} />
            </View>
          </View>
        </Modal>

        {profileModalElement}
      </View>
    );
  }

  // ==========================================
  // 2. DRIVER PARTNER WORKSPACE
  // ==========================================
  if (role === 'DRIVER') {
    return (
      <View style={s.customerRoot}>
        {/* Map Surface */}
        <View style={s.mapSurface}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            route={routePolyline}
            style={s.mapFrame}
          />

          {/* Top Floating Driver Bar */}
          <View style={s.mapTopRow}>
            <View style={s.driverDutyPill}>
              <View
                style={[
                  s.statusDot,
                  { backgroundColor: isDriverOnline ? '#00D084' : '#EF4444' },
                ]}
              />
              <Text style={s.driverDutyText}>
                {isDriverOnline ? 'ONLINE • RADAR ON' : 'OFFLINE • DUTY OFF'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              style={s.profileAvatarBtn}
              onPress={() => setProfileVisible(true)}
            >
              <Icon name="person" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Floating Duty Toggle Button */}
          <View style={s.driverFloatingDutyBox}>
            <Pressable
              style={[s.dutyActionBtn, isDriverOnline && s.dutyActionBtnOnline]}
              onPress={handleToggleDuty}
            >
              <Icon
                name={isDriverOnline ? 'power' : 'radio'}
                size={18}
                color={isDriverOnline ? '#FFFFFF' : '#070C18'}
              />
              <Text
                style={[s.dutyActionBtnText, isDriverOnline && s.dutyActionBtnTextOnline]}
              >
                {isDriverOnline ? 'GO OFFLINE' : 'GO ONLINE TO RECEIVE TRIPS'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Active Trip vs Radar Status Bottom Sheet */}
        <View style={s.driverBottomPanel}>
          <View style={s.sheetHandle} />

          {activeBooking ? (
            <View style={s.driverActiveTripContainer}>
              <View style={s.activeTripHeader}>
                <View>
                  <Text style={s.activeTripKicker}>CURRENT DISPATCH</Text>
                  <Text style={s.activeTripStatusTitle}>
                    {activeBooking.status === 'DRIVER_ACCEPTED'
                      ? 'Heading to Pickup'
                      : activeBooking.status === 'DRIVER_ARRIVING'
                      ? 'Arrived at Pickup'
                      : activeBooking.status === 'TRIP_STARTED'
                      ? 'Driving to Dropoff'
                      : 'Active Trip'}
                  </Text>
                </View>
                <View style={s.activeTripFareBadge}>
                  <Text style={s.activeTripFareVal}>₹{activeBooking.fare}</Text>
                </View>
              </View>

              {/* Addresses */}
              <View style={s.driverAddressesBox}>
                <View style={s.addressItem}>
                  <Icon name="location" size={14} color="#00D084" />
                  <Text style={s.addressText} numberOfLines={1}>
                    {activeBooking.pickupAddress}
                  </Text>
                </View>
                <View style={s.addressDivider} />
                <View style={s.addressItem}>
                  <Icon name="pin" size={14} color="#EF4444" />
                  <Text style={s.addressText} numberOfLines={1}>
                    {activeBooking.dropAddress}
                  </Text>
                </View>
              </View>

              {/* Status Advancement Buttons */}
              <View style={s.driverActionRow}>
                {activeBooking.status === 'DRIVER_ACCEPTED' && (
                  <AppButton
                    label="I Have Arrived at Pickup"
                    onPress={() => handleDriverStatusUpdate('DRIVER_ARRIVING')}
                  />
                )}
                {activeBooking.status === 'DRIVER_ARRIVING' && (
                  <AppButton
                    label="Enter 4-Digit Rider PIN"
                    onPress={() => setShowOtpModal(true)}
                  />
                )}
                {activeBooking.status === 'TRIP_STARTED' && (
                  <AppButton
                    label="Complete & Settle Trip"
                    onPress={() => handleDriverStatusUpdate('TRIP_COMPLETED')}
                  />
                )}
              </View>
            </View>
          ) : (
            <View style={s.driverIdleContainer}>
              <View style={s.driverIdleIconBox}>
                <Icon
                  name={isDriverOnline ? 'radar' : 'cloud-offline'}
                  family={isDriverOnline ? 'material' : 'ionicons'}
                  size={32}
                  color={isDriverOnline ? '#00D084' : '#64748B'}
                />
              </View>
              <Text style={s.driverIdleTitle}>
                {isDriverOnline ? 'Radar Active & Waiting for Trips' : 'You are Currently Offline'}
              </Text>
              <Text style={s.driverIdleSub}>
                {isDriverOnline
                  ? 'Keep this app open. New rider requests within 5km will notify automatically.'
                  : 'Tap GO ONLINE above to start broadcasting your location to riders.'}
              </Text>
            </View>
          )}
        </View>

        {/* Incoming Trip Request Modal */}
        <Modal visible={Boolean(incomingBookingReq)} transparent animationType="slide">
          <View style={s.incomingModalOverlay}>
            <View style={s.incomingCard}>
              <View style={s.incomingHeaderRow}>
                <View style={s.incomingBadge}>
                  <Icon name="flash" size={14} color="#38BDF8" />
                  <Text style={s.incomingBadgeText}>NEW RIDE REQUEST</Text>
                </View>
                <View style={s.timerBadge}>
                  <Text style={s.timerVal}>{incomingTimer}s</Text>
                </View>
              </View>

              <Text style={s.incomingFare}>₹{incomingBookingReq?.fare || 350}</Text>
              <Text style={s.incomingTier}>
                {incomingBookingReq?.serviceTier || 'Express'} • 4.8 km estimated
              </Text>

              <View style={s.incomingAddrBox}>
                <View style={s.addressItem}>
                  <Icon name="location" size={14} color="#00D084" />
                  <Text style={s.incomingAddrText}>{incomingBookingReq?.pickupAddress}</Text>
                </View>
                <View style={s.addressDivider} />
                <View style={s.addressItem}>
                  <Icon name="pin" size={14} color="#EF4444" />
                  <Text style={s.incomingAddrText}>{incomingBookingReq?.dropAddress}</Text>
                </View>
              </View>

              <View style={s.incomingBtnRow}>
                <Pressable
                  style={s.declineBtn}
                  onPress={() => setIncomingBookingReq(null)}
                >
                  <Text style={s.declineBtnText}>Decline</Text>
                </Pressable>
                <Pressable
                  style={s.acceptBtn}
                  onPress={() => incomingBookingReq && handleAcceptRide(incomingBookingReq._id)}
                >
                  <Text style={s.acceptBtnText}>ACCEPT DISPATCH</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* OTP PIN Entry Modal */}
        <Modal visible={showOtpModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.otpCard}>
              <Text style={s.otpTitle}>Enter 4-Digit Rider PIN</Text>
              <Text style={s.otpSub}>
                Ask the passenger for their 4-digit verification code to start the trip.
              </Text>

              <TextInput
                style={s.otpInput}
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="••••"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />

              <AppButton label="Verify & Start Journey" onPress={handleVerifyOtpAndStart} />
              <Pressable style={s.otpCancelBtn} onPress={() => setShowOtpModal(false)}>
                <Text style={s.otpCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {profileModalElement}
      </View>
    );
  }

  // ==========================================
  // 3. FLEET OPERATIONS OWNER WORKSPACE
  // ==========================================
  return (
    <ScrollView style={s.ownerRoot} contentContainerStyle={s.ownerContent}>
      {/* Header */}
      <View style={s.ownerHeader}>
        <View>
          <Text style={s.ownerKicker}>FLEET RADAR COMMAND</Text>
          <Text style={s.ownerTitle}>Operations Dashboard</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={s.avatarBtnLight}
          onPress={() => setProfileVisible(true)}
        >
          <Icon name="person" size={16} color="#0F172A" />
        </Pressable>
      </View>

      {/* KPI Stats */}
      <View style={s.ownerStatsGrid}>
        <View style={s.statCard}>
          <Text style={s.statVal}>{fleet.length}</Text>
          <Text style={s.statLabel}>Total Vehicles</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: '#00D084' }]}>
            {fleet.filter((f: FleetDriver) => f.connection === 'online').length}
          </Text>
          <Text style={s.statLabel}>Online Now</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: '#38BDF8' }]}>100%</Text>
          <Text style={s.statLabel}>Fleet Safety</Text>
        </View>
      </View>

      {/* Map Section */}
      <View style={s.fleetMapSection}>
        <Text style={s.sectionHeading}>Live Vehicle Radar</Text>
        <View style={s.ownerMapFrame}>
          <MapView center={mapCenter} zoom={12} markers={markers} style={s.mapFrame} />
        </View>
      </View>

      {/* Fleet Driver List */}
      <View style={s.driverListSection}>
        <Text style={s.sectionHeading}>Active Fleet Drivers</Text>
        {fleet.length === 0 ? (
          <View style={s.emptyFleetCard}>
            <Icon name="car" size={24} color="#94A3B8" />
            <Text style={s.emptyFleetText}>No vehicles currently broadcasting GPS</Text>
          </View>
        ) : (
          fleet.map((driver: FleetDriver) => (
            <Pressable
              key={driver.driverId}
              style={s.driverRowCard}
              onPress={() => {
                setSelectedDriver(driver);
                setMapCenter({ latitude: driver.latitude, longitude: driver.longitude });
              }}
            >
              <View
                style={[
                  s.statusDot,
                  {
                    backgroundColor:
                      driver.connection === 'online' ? '#00D084' : '#64748B',
                  },
                ]}
              />
              <View style={s.driverInfo}>
                <Text style={s.ownerDriverName}>{driver.driverName || 'Driver Partner'}</Text>
                <Text style={s.ownerDriverSub}>
                  {driver.speed ? `${Math.round(driver.speed)} km/h` : 'Stationary'} •{' '}
                  {driver.connection === 'online' ? 'Radar Broadcasting' : 'Offline'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} color="#94A3B8" />
            </Pressable>
          ))
        )}
      </View>

      {selectedDriver && (
        <DriverDetailModal
          visible={Boolean(selectedDriver)}
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
        />
      )}

      {profileModalElement}
    </ScrollView>
  );
}

const s = StyleSheet.create<{
  customerRoot: ViewStyle;
  mapSurface: ViewStyle;
  mapFrame: ViewStyle;
  mapTopRow: ViewStyle;
  brandBadge: ViewStyle;
  brandBadgeText: TextStyle;
  profileAvatarBtn: ViewStyle;
  floatingEtaPill: ViewStyle;
  floatingEtaText: TextStyle;
  activeRideSheet: ViewStyle;
  sheetHandle: ViewStyle;
  driverCard: ViewStyle;
  driverAvatarBox: ViewStyle;
  driverMeta: ViewStyle;
  driverName: TextStyle;
  driverVehicle: TextStyle;
  otpBadge: ViewStyle;
  otpLabel: TextStyle;
  otpCode: TextStyle;
  tripStatusBox: ViewStyle;
  statusStepRow: ViewStyle;
  statusDot: ViewStyle;
  statusLine: ViewStyle;
  statusLabelsRow: ViewStyle;
  stepLabel: TextStyle;
  sheetActions: ViewStyle;
  callBtn: ViewStyle;
  callBtnText: TextStyle;
  cancelBtn: ViewStyle;
  cancelBtnText: TextStyle;
  bookingSheet: ViewStyle;
  searchBar: ViewStyle;
  searchPlaceholder: TextStyle;
  searchNowBtn: ViewStyle;
  searchNowText: TextStyle;
  bookingFormScroll: ViewStyle;
  bookingFormHeader: ViewStyle;
  sheetTitle: TextStyle;
  inputsContainer: ViewStyle;
  inputRow: ViewStyle;
  pickupPointDot: ViewStyle;
  dropPointSquare: ViewStyle;
  inputDivider: ViewStyle;
  addressInput: TextStyle;
  tiersHeading: TextStyle;
  tiersList: ViewStyle;
  tierCard: ViewStyle;
  tierCardActive: ViewStyle;
  tierIconBox: ViewStyle;
  tierIconBoxActive: ViewStyle;
  tierInfo: ViewStyle;
  tierName: TextStyle;
  tierMeta: TextStyle;
  tierPrice: TextStyle;
  requestBtnBox: ViewStyle;
  modalOverlay: ViewStyle;
  ratingCard: ViewStyle;
  ratingIconBox: ViewStyle;
  ratingTitle: TextStyle;
  ratingSub: TextStyle;
  starRow: ViewStyle;
  tipHeading: TextStyle;
  tipRow: ViewStyle;
  tipPill: ViewStyle;
  tipPillActive: ViewStyle;
  tipText: TextStyle;
  tipTextActive: TextStyle;
  driverDutyPill: ViewStyle;
  driverDutyText: TextStyle;
  driverFloatingDutyBox: ViewStyle;
  dutyActionBtn: ViewStyle;
  dutyActionBtnOnline: ViewStyle;
  dutyActionBtnText: TextStyle;
  dutyActionBtnTextOnline: TextStyle;
  driverBottomPanel: ViewStyle;
  driverActiveTripContainer: ViewStyle;
  activeTripHeader: ViewStyle;
  activeTripKicker: TextStyle;
  activeTripStatusTitle: TextStyle;
  activeTripFareBadge: ViewStyle;
  activeTripFareVal: TextStyle;
  driverAddressesBox: ViewStyle;
  addressItem: ViewStyle;
  addressDivider: ViewStyle;
  addressText: TextStyle;
  driverActionRow: ViewStyle;
  driverIdleContainer: ViewStyle;
  driverIdleIconBox: ViewStyle;
  driverIdleTitle: TextStyle;
  driverIdleSub: TextStyle;
  incomingModalOverlay: ViewStyle;
  incomingCard: ViewStyle;
  incomingHeaderRow: ViewStyle;
  incomingBadge: ViewStyle;
  incomingBadgeText: TextStyle;
  timerBadge: ViewStyle;
  timerVal: TextStyle;
  incomingFare: TextStyle;
  incomingTier: TextStyle;
  incomingAddrBox: ViewStyle;
  incomingAddrText: TextStyle;
  incomingBtnRow: ViewStyle;
  declineBtn: ViewStyle;
  declineBtnText: TextStyle;
  acceptBtn: ViewStyle;
  acceptBtnText: TextStyle;
  otpCard: ViewStyle;
  otpTitle: TextStyle;
  otpSub: TextStyle;
  otpInput: TextStyle;
  otpCancelBtn: ViewStyle;
  otpCancelText: TextStyle;
  ownerRoot: ViewStyle;
  ownerContent: ViewStyle;
  ownerHeader: ViewStyle;
  ownerKicker: TextStyle;
  ownerTitle: TextStyle;
  avatarBtnLight: ViewStyle;
  ownerStatsGrid: ViewStyle;
  statCard: ViewStyle;
  statVal: TextStyle;
  statLabel: TextStyle;
  fleetMapSection: ViewStyle;
  sectionHeading: TextStyle;
  ownerMapFrame: ViewStyle;
  driverListSection: ViewStyle;
  emptyFleetCard: ViewStyle;
  emptyFleetText: TextStyle;
  driverRowCard: ViewStyle;
  driverInfo: ViewStyle;
  ownerDriverName: TextStyle;
  ownerDriverSub: TextStyle;
}>({
  customerRoot: { flex: 1, backgroundColor: '#070C18' },
  mapSurface: { flex: 1, position: 'relative' },
  mapFrame: { width: '100%', height: '100%' },
  mapTopRow: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 4,
  },
  brandBadgeText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 4,
  },
  floatingEtaPill: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00D084',
    elevation: 6,
  },
  floatingEtaText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  activeRideSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  driverAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 15,
  },
  driverVehicle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  otpBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderWidth: 1,
    borderColor: '#00D084',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  otpLabel: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  otpCode: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
  },
  tripStatusBox: {
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  statusStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  statusLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  callBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  cancelBtnText: {
    color: '#FCA5A5',
    fontWeight: '800',
    fontSize: 13,
  },
  bookingSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchPlaceholder: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  searchNowBtn: {
    backgroundColor: '#00D084',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchNowText: {
    color: '#070C18',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  bookingFormScroll: {
    maxHeight: 380,
  },
  bookingFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  inputsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickupPointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D084',
  },
  dropPointSquare: {
    width: 8,
    height: 8,
    backgroundColor: '#EF4444',
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
    marginLeft: 18,
  },
  addressInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 4,
  },
  tiersHeading: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 14,
    marginBottom: 8,
  },
  tiersList: {
    gap: 8,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  tierCardActive: {
    backgroundColor: '#1A293E',
    borderColor: '#00D084',
  },
  tierIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIconBoxActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  tierMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  tierPrice: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 15,
  },
  requestBtnBox: {
    marginTop: 14,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 24, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ratingTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  ratingSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  tipHeading: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tipPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tipPillActive: {
    backgroundColor: '#00D084',
    borderColor: '#00D084',
  },
  tipText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  tipTextActive: {
    color: '#070C18',
    fontWeight: '900',
  },
  driverDutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  driverDutyText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  driverFloatingDutyBox: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  dutyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D084',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    elevation: 6,
  },
  dutyActionBtnOnline: {
    backgroundColor: '#EF4444',
  },
  dutyActionBtnText: {
    color: '#070C18',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  dutyActionBtnTextOnline: {
    color: '#FFFFFF',
  },
  driverBottomPanel: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  driverActiveTripContainer: {
    gap: 12,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeTripKicker: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  activeTripStatusTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  activeTripFareBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeTripFareVal: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 16,
  },
  driverAddressesBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
    marginLeft: 22,
  },
  addressText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  driverActionRow: {
    marginTop: 4,
  },
  driverIdleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  driverIdleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  driverIdleTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 15,
  },
  driverIdleSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 17,
  },
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 24, 0.85)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  incomingCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    gap: 10,
  },
  incomingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  incomingBadgeText: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  timerBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timerVal: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  incomingFare: {
    color: '#00D084',
    fontSize: 28,
    fontWeight: '900',
  },
  incomingTier: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: -4,
  },
  incomingAddrBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    gap: 6,
  },
  incomingAddrText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  incomingBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 13,
  },
  acceptBtn: {
    flex: 2,
    backgroundColor: '#00D084',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#070C18',
    fontWeight: '900',
    fontSize: 14,
  },
  otpCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  otpTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  otpSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  otpInput: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginBottom: 16,
  },
  otpCancelBtn: {
    marginTop: 12,
  },
  otpCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  ownerRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  ownerContent: {
    padding: 16,
    paddingTop: 48,
  },
  ownerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ownerKicker: {
    color: '#2563EB',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  ownerTitle: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  avatarBtnLight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  ownerStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  fleetMapSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  ownerMapFrame: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverListSection: {
    gap: 8,
    paddingBottom: 24,
  },
  emptyFleetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyFleetText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  driverRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverInfo: {
    flex: 1,
  },
  ownerDriverName: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  ownerDriverSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
});
