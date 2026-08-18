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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { Card, Input } from '../components/ui';
import { MapView, type MapMarker, type RoutePolyline } from '../components/MapView';
import { ProfileModal } from '../components/ProfileModal';
import { DriverDetailModal } from '../components/DriverDetailModal';
import { NotificationBanner, type NotificationItem } from '../components/NotificationBanner';
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
}

const RIDE_TIERS: RideTier[] = [
  {
    id: 'uberx',
    name: 'BlackSquad Express',
    eta: '3 mins away',
    price: '₹280',
    fareNumber: 280,
    desc: 'Fast, comfortable city sedan',
    icon: '🚗',
  },
  {
    id: 'comfort',
    name: 'Fleet Comfort Van',
    eta: '5 mins away',
    price: '₹450',
    fareNumber: 450,
    desc: 'Extra space for groups & cargo',
    icon: '🚐',
  },
  {
    id: 'heavy',
    name: 'Heavy Freight Hauler',
    eta: '8 mins away',
    price: '₹950',
    fareNumber: 950,
    desc: 'Commercial logistics transport',
    icon: '🚛',
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
              title: 'Driver Accepted Your Ride! 🚗',
              body: 'Your driver is en route to pickup.',
            });
          } else if (payload.status === 'DRIVER_ARRIVING') {
            setNotification({
              id: Date.now().toString(),
              title: 'Driver Has Arrived! 📍',
              body: 'Please meet your driver at the pickup location.',
            });
          } else if (payload.status === 'TRIP_STARTED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Trip Started! 🛣️',
              body: 'Sit back and relax. Enjoy your ride!',
            });
          } else if (payload.status === 'TRIP_COMPLETED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Trip Completed! 🎉',
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

  // RIDER: Create Ride
  const handleBookRide = async () => {
    if (!destination.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a destination address.');
      return;
    }

    const selected = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];
    setBookingModal(true);

    try {
      // Bangalore Coordinates
      const pickupCoords: [number, number] = [77.6834, 12.926];
      const dropCoords: [number, number] = [77.6066, 12.9756];

      const booking = await createBooking({
        pickupAddress: pickup,
        dropAddress: destination,
        pickupCoordinates: pickupCoords,
        dropCoordinates: dropCoords,
        serviceTier: selected.id,
        fare: selected.fareNumber,
        distanceKm: 8.5,
      });

      setActiveBooking(booking);
      if (socketRef.current) {
        joinBookingRoom(socketRef.current, booking._id);
      }
    } catch (e: any) {
      setBookingModal(false);
      if (Platform.OS === 'web') {
        window.alert(e.message || 'Failed to create booking request');
      }
    }
  };

  // DRIVER: Toggle Online Duty
  const toggleDriverOnline = async () => {
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
        badgeText: '🟢',
      });
    }

    // Drop Pin
    if (activeBooking.dropLocation?.coordinates) {
      markers.push({
        id: 'drop',
        longitude: activeBooking.dropLocation.coordinates[0],
        latitude: activeBooking.dropLocation.coordinates[1],
        title: `Destination: ${activeBooking.dropAddress}`,
        color: '#DC2626',
        badgeText: '🏁',
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
        badgeText: '🚗',
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
            color: '#2563EB',
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
        badgeText: '🚗',
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
              <Text style={s.brandLogoIcon}>⚡</Text>
              <Text style={s.brandBadgeText}>BLACKSQUAD</Text>
            </View>

            <Pressable style={s.profileAvatarBtn} onPress={() => setProfileVisible(true)}>
              <Text style={s.profileAvatarIcon}>👤</Text>
            </Pressable>
          </View>

          {/* Live ETA Floating Pill during active ride */}
          {activeBooking && (
            <View style={s.floatingEtaPill}>
              <Text style={s.floatingEtaIcon}>🚗</Text>
              <Text style={s.floatingEtaText}>
                {activeBooking.status === 'REQUESTED'
                  ? '🔍 Finding nearest verified driver...'
                  : activeBooking.status === 'DRIVER_ACCEPTED'
                  ? `Driver on the way • ${driverLiveLoc?.etaMinutes || 4} mins ETA`
                  : activeBooking.status === 'DRIVER_ARRIVING'
                  ? '📍 Driver has arrived at your pickup spot!'
                  : activeBooking.status === 'TRIP_STARTED'
                  ? `🛣️ En route to destination • ₹${activeBooking.fare}`
                  : 'Trip in progress'}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Sheet: Active Tracking vs Booking Creator */}
        {activeBooking ? (
          /* ==================================================== */
          /* UBER-STYLE ACTIVE LIVE RIDE TRACKING SHEET */
          /* ==================================================== */
          <View style={s.activeRideSheet}>
            <View style={s.sheetHandle} />

            {/* Driver & Vehicle Header Card */}
            <View style={s.driverCard}>
              <View style={s.driverAvatarBox}>
                <Text style={s.driverAvatarText}>
                  {typeof activeBooking.driverId === 'object' &&
                  activeBooking.driverId?.userId?.name
                    ? activeBooking.driverId.userId.name.slice(0, 2).toUpperCase()
                    : 'BS'}
                </Text>
              </View>

              <View style={s.driverMeta}>
                <Text style={s.driverName}>
                  {typeof activeBooking.driverId === 'object' &&
                  activeBooking.driverId?.userId?.name
                    ? activeBooking.driverId.userId.name
                    : 'BlackSquad Driver'}
                </Text>
                <View style={s.ratingRow}>
                  <Text style={s.ratingStar}>★</Text>
                  <Text style={s.ratingScore}>4.96</Text>
                  <Text style={s.vehicleName}>
                    •{' '}
                    {typeof activeBooking.vehicleId === 'object' &&
                    activeBooking.vehicleId?.model
                      ? activeBooking.vehicleId.model
                      : 'White Toyota Innova'}
                  </Text>
                </View>
              </View>

              <View style={s.platePill}>
                <Text style={s.plateText}>
                  {typeof activeBooking.vehicleId === 'object' &&
                  activeBooking.vehicleId?.registrationNumber
                    ? activeBooking.vehicleId.registrationNumber
                    : 'KA 04 MP 8821'}
                </Text>
              </View>
            </View>

            {/* Ride Start 4-Digit Security PIN (Uber standard) */}
            {activeBooking.startOtp && activeBooking.status !== 'TRIP_STARTED' && (
              <View style={s.otpBox}>
                <View>
                  <Text style={s.otpLabel}>SHARE PIN WITH DRIVER</Text>
                  <Text style={s.otpSub}>Required to start your secure ride</Text>
                </View>
                <View style={s.otpCodePill}>
                  <Text style={s.otpCodeText}>{activeBooking.startOtp}</Text>
                </View>
              </View>
            )}

            {/* Action Buttons: Call, Message, Safety SOS, Share */}
            <View style={s.rideActionsRow}>
              <Pressable
                style={s.rideActionBtn}
                onPress={() => {
                  if (Platform.OS === 'web') window.alert('📞 Calling driver (+91 98765 43210)...');
                }}
              >
                <Text style={s.rideActionIcon}>📞</Text>
                <Text style={s.rideActionText}>Call</Text>
              </Pressable>

              <Pressable
                style={s.rideActionBtn}
                onPress={() => {
                  if (Platform.OS === 'web') window.alert('💬 Live chat with driver opened.');
                }}
              >
                <Text style={s.rideActionIcon}>💬</Text>
                <Text style={s.rideActionText}>Message</Text>
              </Pressable>

              <Pressable
                style={[s.rideActionBtn, s.sosActionBtn]}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.alert('🚨 Emergency SOS broadcasted to BlackSquad 24x7 Safety Response.');
                  }
                }}
              >
                <Text style={s.rideActionIcon}>🛡️</Text>
                <Text style={[s.rideActionText, { color: '#EF4444' }]}>Safety</Text>
              </Pressable>

              <Pressable
                style={s.rideActionBtn}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.alert('🔗 Live tracking link copied to clipboard!');
                  }
                }}
              >
                <Text style={s.rideActionIcon}>🔗</Text>
                <Text style={s.rideActionText}>Share</Text>
              </Pressable>
            </View>

            {/* Trip Details & Cancel Option */}
            <View style={s.tripSummaryRow}>
              <View style={s.tripSummaryCol}>
                <Text style={s.tripSummaryLabel}>PICKUP</Text>
                <Text style={s.tripSummaryValue} numberOfLines={1}>
                  {activeBooking.pickupAddress}
                </Text>
              </View>
              <View style={s.tripSummaryCol}>
                <Text style={s.tripSummaryLabel}>DROP-OFF</Text>
                <Text style={s.tripSummaryValue} numberOfLines={1}>
                  {activeBooking.dropAddress}
                </Text>
              </View>
            </View>

            {activeBooking.status !== 'TRIP_STARTED' && (
              <Pressable style={s.cancelRideBtn} onPress={handleCancelBooking}>
                <Text style={s.cancelRideText}>Cancel Ride</Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* ==================================================== */
          /* BOOKING CREATOR SHEET */
          /* ==================================================== */
          <Card style={s.sheet}>
            <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Where to, Pilot?</Text>
              <Text style={s.sheetSubtitle}>Choose verified transport across Bangalore</Text>

              {/* Route Input Fields */}
              <View style={s.routeFields}>
                <View style={s.routeLine}>
                  <View style={[s.routeDot, s.pickupDot]} />
                  <View style={s.connector} />
                  <View style={[s.routeDot, s.destinationDot]} />
                </View>

                <View style={s.inputs}>
                  <Input
                    label="PICKUP SPOT"
                    value={pickup}
                    onChangeText={setPickup}
                    placeholder="Enter pickup address"
                  />
                  <Input
                    label="DESTINATION"
                    value={destination}
                    onChangeText={setDestination}
                    placeholder="Where are you going?"
                  />
                </View>
              </View>

              {/* Ride Tier Selection */}
              <View style={s.tierSection}>
                <Text style={s.tierHeading}>SELECT FLEET CLASS</Text>
                {RIDE_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  return (
                    <Pressable
                      key={tier.id}
                      style={[s.tierCard, isSelected && s.selectedTierCard]}
                      onPress={() => setSelectedTier(tier.id)}
                    >
                      <Text style={s.tierIcon}>{tier.icon}</Text>
                      <View style={s.tierInfo}>
                        <View style={s.tierHeaderRow}>
                          <Text style={s.tierName}>{tier.name}</Text>
                          <Text style={s.tierPrice}>{tier.price}</Text>
                        </View>
                        <Text style={s.tierDesc}>
                          {tier.desc} • <Text style={s.etaText}>{tier.eta}</Text>
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <AppButton
                label="🚗 Confirm & Request BlackSquad Ride"
                onPress={handleBookRide}
                style={s.button}
              />
            </ScrollView>
          </Card>
        )}

        {/* POST-TRIP RATING MODAL */}
        <Modal visible={showRatingModal} transparent animationType="fade">
          <View style={s.ratingOverlay}>
            <View style={s.ratingCard}>
              <Text style={s.ratingEmoji}>🎉</Text>
              <Text style={s.ratingTitle}>You Have Arrived!</Text>
              <Text style={s.ratingSub}>How was your ride with BlackSquad?</Text>

              {/* Star Selector */}
              <View style={s.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setUserRating(star)}>
                    <Text style={[s.starIcon, userRating >= star && s.starActive]}>★</Text>
                  </Pressable>
                ))}
              </View>

              {/* Tip Selection */}
              <Text style={s.tipHeading}>ADD A DRIVER TIP</Text>
              <View style={s.tipRow}>
                {[0, 20, 50, 100].map((amt) => (
                  <Pressable
                    key={amt}
                    style={[s.tipPill, tipAmount === amt && s.tipPillActive]}
                    onPress={() => setTipAmount(amt)}
                  >
                    <Text style={[s.tipText, tipAmount === amt && s.tipTextActive]}>
                      {amt === 0 ? 'No Tip' : `₹${amt}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AppButton label="Submit Rating & Close" onPress={handleSubmitRating} />
            </View>
          </View>
        </Modal>

        {profileModalElement}
      </View>
    );
  }

  // ==========================================
  // 2. DRIVER LIVE WORKSPACE
  // ==========================================
  if (role === 'DRIVER') {
    return (
      <Screen>
        {notification && (
          <NotificationBanner
            notification={notification}
            onDismiss={() => setNotification(null)}
          />
        )}

        {/* Top Header */}
        <View style={s.driverHeaderRow}>
          <View>
            <Text style={s.kicker}>DRIVER COCKPIT</Text>
            <Text style={s.title}>Telemetry & Trips</Text>
          </View>
          <Pressable style={s.avatarBtn} onPress={() => setProfileVisible(true)}>
            <Text style={s.avatarBtnText}>👤 Profile & Bank</Text>
          </Pressable>
        </View>

        {/* Uber-grade Master Online / Offline Duty Control */}
        {!isDriverOnline ? (
          <Pressable style={s.goOnlineHeroCard} onPress={toggleDriverOnline}>
            <View style={s.goOnlinePulsar}>
              <Text style={s.goOnlinePulsarIcon}>⚡</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.goOnlineHeroTitle}>GO ONLINE</Text>
              <Text style={s.goOnlineHeroSubtitle}>Tap to broadcast location and receive rides</Text>
            </View>
            <View style={s.goOnlineArrowBadge}>
              <Text style={s.goOnlineArrowText}>➔</Text>
            </View>
          </Pressable>
        ) : (
          <Card style={s.driverOnlineActiveCard}>
            <View style={s.dutyHeader}>
              <View style={s.dutyStatusInfo}>
                <View style={[s.statusCircle, { backgroundColor: '#10B981' }]} />
                <View>
                  <Text style={s.dutyStatusActiveTitle}>YOU ARE ONLINE</Text>
                  <Text style={s.dutyStatusActiveSub}>Searching for nearby passengers...</Text>
                </View>
              </View>
              <Pressable style={s.dutyOfflineBtn} onPress={toggleDriverOnline}>
                <Text style={s.dutyOfflineBtnText}>GO OFFLINE</Text>
              </Pressable>
            </View>
            <View style={s.radarNotice}>
              <Text style={s.radarNoticeText}>
                🛰️ Live high-accuracy GPS telemetry streamed to dispatch room every 4s.
              </Text>
            </View>
          </Card>
        )}

        {/* Active Trip Navigation for Driver */}
        {activeBooking ? (
          <Card style={[s.activeTripDriverCard, { marginTop: spacing.lg }]}>
            <Text style={s.activeTripKicker}>CURRENT ASSIGNED TRIP</Text>
            <Text style={s.activeTripStatus}>Status: {activeBooking.status}</Text>

            <View style={s.tripAddresses}>
              <Text style={s.addressLabel}>PICKUP:</Text>
              <Text style={s.addressVal}>{activeBooking.pickupAddress}</Text>

              <Text style={[s.addressLabel, { marginTop: spacing.xs }]}>DROP-OFF:</Text>
              <Text style={s.addressVal}>{activeBooking.dropAddress}</Text>
            </View>

            <View style={s.fareBanner}>
              <Text style={s.fareBannerLabel}>TRIP FARE</Text>
              <Text style={s.fareBannerVal}>₹{activeBooking.fare}</Text>
            </View>

            {/* Driver State Actions */}
            {activeBooking.status === 'DRIVER_ACCEPTED' && (
              <AppButton
                label="📍 I Have Arrived at Pickup"
                onPress={() => handleDriverStatusUpdate('DRIVER_ARRIVING')}
                style={{ marginTop: spacing.md }}
              />
            )}

            {activeBooking.status === 'DRIVER_ARRIVING' && (
              <AppButton
                label="🔑 Verify Rider PIN & Start Trip"
                onPress={() => handleDriverStatusUpdate('TRIP_STARTED')}
                style={{ marginTop: spacing.md }}
              />
            )}

            {activeBooking.status === 'TRIP_STARTED' && (
              <AppButton
                label="🏁 Complete Trip & Collect Cash/UPI"
                onPress={() => handleDriverStatusUpdate('TRIP_COMPLETED')}
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        ) : (
          <View style={s.driverWaitingBox}>
            <Text style={s.driverWaitingIcon}>📡</Text>
            <Text style={s.driverWaitingTitle}>
              {isDriverOnline ? 'Searching for passenger ride requests...' : 'Go Online to Receive Rides'}
            </Text>
            <Text style={s.driverWaitingSub}>
              Ensure your linked bank account and IFSC details are up to date in your profile.
            </Text>
          </View>
        )}

        {/* INCOMING RIDE REQUEST SHEET (15s TIMER) */}
        {incomingBookingReq && (
          <Modal visible transparent animationType="slide">
            <View style={s.incomingOverlay}>
              <View style={s.incomingCard}>
                <View style={s.incomingHeader}>
                  <Text style={s.incomingTitle}>⚡ New Ride Request!</Text>
                  <View style={s.timerBadge}>
                    <Text style={s.timerText}>{incomingTimer}s</Text>
                  </View>
                </View>

                <Text style={s.incomingFare}>₹{incomingBookingReq.fare}</Text>
                <Text style={s.incomingDist}>
                  {incomingBookingReq.distanceKm || 8.5} km • {incomingBookingReq.serviceTier}
                </Text>

                <View style={s.incomingAddresses}>
                  <Text style={s.incomingAddrLabel}>Pickup:</Text>
                  <Text style={s.incomingAddrVal} numberOfLines={1}>
                    {incomingBookingReq.pickupAddress}
                  </Text>
                  <Text style={s.incomingAddrLabel}>Drop-off:</Text>
                  <Text style={s.incomingAddrVal} numberOfLines={1}>
                    {incomingBookingReq.dropAddress}
                  </Text>
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
                    onPress={() => handleAcceptRide(incomingBookingReq._id)}
                  >
                    <Text style={s.acceptBtnText}>Accept Ride</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* OTP VERIFICATION DIALOG */}
        <Modal visible={showOtpModal} transparent animationType="fade">
          <View style={s.ratingOverlay}>
            <View style={s.otpVerifyCard}>
              <Text style={s.otpVerifyTitle}>Enter Rider's 4-Digit PIN</Text>
              <Text style={s.otpVerifySub}>
                Ask passenger for the 4-digit PIN displayed on their phone.
              </Text>

              <TextInput
                style={s.otpInput}
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="4-digit PIN"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                maxLength={4}
              />

              <AppButton label="Verify & Start Trip" onPress={handleVerifyOtpAndStart} />

              <Pressable style={s.otpCancelBtn} onPress={() => setShowOtpModal(false)}>
                <Text style={s.otpCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {profileModalElement}
      </Screen>
    );
  }

  // ==========================================
  // 3. FLEET OWNER WORKSPACE
  // ==========================================
  return (
    <Screen>
      <View style={s.ownerHeader}>
        <View>
          <Text style={s.ownerKicker}>FLEET COMMAND CENTER</Text>
          <Text style={s.ownerTitle}>Active Operations</Text>
        </View>
        <Pressable style={s.avatarBtnLight} onPress={() => setProfileVisible(true)}>
          <Text style={s.avatarBtnLightText}>👤 Account</Text>
        </Pressable>
      </View>

      <View style={s.ownerStats}>
        <View>
          <Text style={s.statValue}>{fleet.length}</Text>
          <Text style={s.statLabel}>Active Vehicles</Text>
        </View>
        <View>
          <Text style={[s.statValue, { color: '#00D084' }]}>
            {fleet.filter((d: FleetDriver) => d.connection === 'online').length}
          </Text>
          <Text style={s.statLabel}>Online</Text>
        </View>
        <View>
          <Text style={[s.statValue, { color: '#2563EB' }]}>₹24,850</Text>
          <Text style={s.statLabel}>Today's Revenue</Text>
        </View>
      </View>

      <View style={s.fleetMap}>
        <Text style={s.sectionTitle}>Live Fleet Telemetry</Text>
        <View style={s.ownerMap}>
          <MapView center={mapCenter} zoom={12} markers={markers} />
        </View>
      </View>

      <Text style={s.sectionTitle}>Drivers & Status</Text>
      <View style={s.driverList}>
        {fleet.map((driver: FleetDriver) => (
          <Pressable key={driver.driverId} onPress={() => setSelectedDriver(driver)}>
            <Card style={s.driverRowCard}>
              <View style={s.driverRow}>
                <View
                  style={[
                    s.statusDot,
                    { backgroundColor: driver.connection === 'online' ? '#00D084' : '#64748B' },
                  ]}
                />
                <View style={s.driverInfo}>
                  <Text style={s.ownerDriverName}>{driver.driverName || 'Driver'}</Text>
                  <Text style={s.ownerDriverVehicle}>ID: {driver.driverId.slice(-6)}</Text>
                </View>
                <Text
                  style={[
                    s.ownerDriverState,
                    { color: driver.connection === 'online' ? '#00D084' : '#64748B' },
                  ]}
                >
                  {driver.connection === 'online' ? 'ONLINE' : 'STALE'}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <DriverDetailModal
        driver={selectedDriver}
        onClose={() => setSelectedDriver(null)}
        onTrackOnMap={(lat: number, lng: number) => setMapCenter({ latitude: lat, longitude: lng })}
      />

      {profileModalElement}
    </Screen>
  );
}

const s = StyleSheet.create<any>({
  customerRoot: { flex: 1, backgroundColor: '#070C18' },
  mapSurface: { flex: 1, minHeight: 320, backgroundColor: '#DCEBDF', position: 'relative' },
  mapFrame: { position: 'absolute', width: '100%', height: '100%' },
  mapTopRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 48 : spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  brandLogoIcon: { color: '#00D084', fontSize: 14 },
  brandBadgeText: { color: '#F8FAFC', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  profileAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileAvatarIcon: { fontSize: 18 },
  floatingEtaPill: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: '#0A0F1D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#00D084',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10,
  },
  floatingEtaIcon: { fontSize: 16 },
  floatingEtaText: { color: '#F8FAFC', fontWeight: '800', fontSize: 13 },
  activeRideSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.md,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  driverAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  driverMeta: { flex: 1 },
  driverName: { color: '#F8FAFC', fontWeight: '800', fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingStar: { color: '#FACC15', fontSize: 12 },
  ratingScore: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  vehicleName: { color: '#94A3B8', fontSize: 12 },
  platePill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  plateText: { color: '#38BDF8', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  otpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.md,
  },
  otpLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  otpSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  otpCodePill: {
    backgroundColor: '#00D084',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  otpCodeText: { color: '#070C18', fontWeight: '900', fontSize: 18, letterSpacing: 2 },
  rideActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rideActionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  sosActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  rideActionIcon: { fontSize: 18 },
  rideActionText: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  tripSummaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: '#162032',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  tripSummaryCol: { flex: 1 },
  tripSummaryLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tripSummaryValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '600', marginTop: 2 },
  cancelRideBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelRideText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  sheet: {
    marginTop: -18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    flex: 1,
  },
  sheetScroll: { flex: 1 },
  sheetTitle: { ...typography.sectionTitle, color: lightColors.text },
  sheetSubtitle: {
    ...typography.secondary,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  routeFields: { flexDirection: 'row', gap: spacing.sm },
  routeLine: { width: 14, alignItems: 'center', paddingTop: 17, paddingBottom: 17 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#FFFFFF' },
  pickupDot: { borderColor: '#2563EB' },
  destinationDot: { borderColor: '#0F172A' },
  connector: { flex: 1, width: 1, backgroundColor: lightColors.borderStrong, marginVertical: 5 },
  inputs: { flex: 1, gap: spacing.sm },
  tierSection: { marginTop: spacing.lg, gap: spacing.sm },
  tierHeading: { color: '#0F172A', fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 2 },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: spacing.md,
  },
  selectedTierCard: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  tierIcon: { fontSize: 24 },
  tierInfo: { flex: 1 },
  tierHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierName: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  tierPrice: { color: '#2563EB', fontWeight: '800', fontSize: 15 },
  tierDesc: { color: '#64748B', fontSize: 11, marginTop: 2 },
  etaText: { color: '#16A34A', fontWeight: '700' },
  button: { marginTop: spacing.lg },
  ratingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 13, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingEmoji: { fontSize: 44, marginBottom: spacing.xs },
  ratingTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
  ratingSub: { color: '#94A3B8', fontSize: 13, marginTop: 2, marginBottom: spacing.lg },
  starRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  starIcon: { fontSize: 32, color: '#334155' },
  starActive: { color: '#FACC15' },
  tipHeading: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm },
  tipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  tipPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tipPillActive: { backgroundColor: '#00D084', borderColor: '#00D084' },
  tipText: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  tipTextActive: { color: '#070C18' },
  driverHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  kicker: { color: darkColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  title: { ...typography.pageTitle, color: darkColors.text, marginTop: spacing.xs, marginBottom: 0 },
  avatarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarBtnText: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  goOnlineHeroCard: {
    backgroundColor: '#07100D',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  goOnlinePulsar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goOnlinePulsarIcon: { fontSize: 22, color: '#10B981' },
  goOnlineHeroTitle: { color: '#10B981', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  goOnlineHeroSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2, fontWeight: '500' },
  goOnlineArrowBadge: {
    backgroundColor: '#10B981',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  goOnlineArrowText: { color: '#07100D', fontWeight: '900', fontSize: 14 },
  driverOnlineActiveCard: {
    backgroundColor: '#07100D',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dutyStatusInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusCircle: { width: 12, height: 12, borderRadius: 6 },
  dutyStatusActiveTitle: { color: '#10B981', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  dutyStatusActiveSub: { color: '#94A3B8', fontSize: 11, fontWeight: '500' },
  dutyOfflineBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  dutyOfflineBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  radarNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  radarNoticeText: { color: '#34D399', fontSize: 11, fontWeight: '600' },
  activeTripDriverCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeTripKicker: { color: '#38BDF8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  activeTripStatus: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', marginTop: 2 },
  tripAddresses: { marginVertical: spacing.md },
  addressLabel: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  addressVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginTop: 2 },
  fareBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  fareBannerLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  fareBannerVal: { color: '#00D084', fontWeight: '900', fontSize: 16 },
  driverWaitingBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
  },
  driverWaitingIcon: { fontSize: 44, marginBottom: spacing.md },
  driverWaitingTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  driverWaitingSub: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  incomingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 13, 0.85)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  incomingCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  incomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incomingTitle: { color: '#38BDF8', fontSize: 18, fontWeight: '900' },
  timerBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  incomingFare: { color: '#00D084', fontSize: 32, fontWeight: '900', marginTop: spacing.xs },
  incomingDist: { color: '#94A3B8', fontSize: 13, marginBottom: spacing.md },
  incomingAddresses: {
    backgroundColor: '#1E293B',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  incomingAddrLabel: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  incomingAddrVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  incomingBtnRow: { flexDirection: 'row', gap: spacing.md },
  declineBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  declineBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 14 },
  acceptBtn: {
    flex: 2,
    backgroundColor: '#00D084',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#070C18', fontWeight: '900', fontSize: 15 },
  otpVerifyCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  otpVerifyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  otpVerifySub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginVertical: spacing.sm },
  otpInput: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: radius.sm,
    padding: spacing.md,
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  otpCancelBtn: { marginTop: spacing.md },
  otpCancelText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  ownerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  ownerKicker: { color: lightColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  ownerTitle: { color: lightColors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: spacing.xs },
  avatarBtnLight: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  avatarBtnLightText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },
  ownerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: lightColors.surfaceSubtle,
    borderWidth: 1,
    borderColor: lightColors.border,
    marginBottom: spacing.xl,
  },
  statValue: { color: lightColors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: lightColors.textSecondary, fontSize: 12, marginTop: spacing.xxs },
  fleetMap: { marginBottom: spacing.xl },
  sectionTitle: { color: lightColors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  ownerMap: { height: 230, overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#DCEBDF', position: 'relative' },
  driverList: { gap: spacing.sm },
  driverRowCard: { padding: spacing.md, backgroundColor: '#FFFFFF' },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  driverInfo: { flex: 1 },
  ownerDriverName: { color: lightColors.text, fontWeight: '700', fontSize: 15 },
  ownerDriverVehicle: { color: lightColors.textSecondary, fontSize: 12, marginTop: 2 },
  ownerDriverState: { fontSize: 12, fontWeight: '700' },
});
