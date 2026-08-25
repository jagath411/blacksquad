import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { FleetAnalyticsModal } from '../components/FleetAnalyticsModal';
import { NotificationBanner, type NotificationItem } from '../components/NotificationBanner';
import { Icon } from '../components/ui/Icon';
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
import {
  getCurrentDeviceLocation,
  startDriverTracking,
  type TrackerStatus,
} from '../services/driverTracker';
import { useFleet } from '../hooks/useFleet';
import { clearAllStorage } from '../services/tokenStore';
import {
  acceptBooking,
  createBooking,
  getActiveBooking,
  rateBooking,
  updateBookingStatus,
} from '../services/bookingService';
import { formatUnifiedError } from '../utils/errorHandler';

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
  const [pickup, setPickup] = useState('My Current Location');
  const [destination, setDestination] = useState('');
  const [selectedTier, setSelectedTier] = useState('uberx');
  const [bookingModal, setBookingModal] = useState(false);
  const [activeBooking, setActiveBooking] = useState<BookingData | null>(null);
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);

  // Device GPS Location State
  const [deviceLocation, setDeviceLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Live Driver Tracking States
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
  const [mapZoom, setMapZoom] = useState(14);

  // Driver duty & Fleet
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('offline');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const { drivers } = useFleet();

  const socketRef = useRef<FleetSocket | null>(null);
  const trackerCleanupRef = useRef<(() => void) | null>(null);

  // 1. Initial Device GPS Location Fetch
  const fetchCurrentLocation = async (centerMap = true) => {
    setIsLocating(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (loc) {
        setDeviceLocation(loc);
        if (centerMap) {
          setMapCenter({ latitude: loc.latitude, longitude: loc.longitude });
          setMapZoom(15);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Location acquisition notice:', err);
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    fetchCurrentLocation(true);
  }, []);

  // 2. Initialize Socket and Active Booking
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const socket = await createFleetSocket();
        if (!isMounted) return;
        socketRef.current = socket;

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

        const unsubscribeLocation = onBookingLocationUpdate(socket, (loc) => {
          setDriverLiveLoc(loc);
          setMapCenter({ latitude: loc.latitude, longitude: loc.longitude });
        });

        const unsubscribeStatus = onBookingStatusChange(socket, (payload) => {
          if (payload.booking) {
            setActiveBooking(payload.booking);
          }
          if (payload.status === 'DRIVER_ACCEPTED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Driver Accepted Your Ride',
              body: 'Your driver partner is en route to your pickup point.',
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
              body: 'Ride OTP verified. Have a safe journey!',
            });
          } else if (payload.status === 'TRIP_COMPLETED') {
            setNotification({
              id: Date.now().toString(),
              title: 'Trip Completed',
              body: 'You have arrived safely at your destination.',
            });
            setShowRatingModal(true);
          }
        });

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
        console.log('Socket initialization notice:', err);
      }
    }

    const cleanupPromise = init();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [role, isDriverOnline]);

  // 3. Driver Incoming Request Countdown Timer
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

  // 4. Periodic Sync for Active Booking
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
    const pickupCoords: [number, number] = deviceLocation
      ? [deviceLocation.longitude, deviceLocation.latitude]
      : [77.5946, 12.9716];

    try {
      const newBooking = await createBooking({
        pickupAddress: pickup === 'My Current Location' ? 'Current GPS Location' : pickup,
        pickupCoordinates: pickupCoords,
        dropAddress: destination,
        dropCoordinates: [pickupCoords[0] + 0.035, pickupCoords[1] - 0.025],
        fare: selectedTierObj.fareNumber,
        serviceTier: selectedTierObj.name,
      });

      setActiveBooking(newBooking);
      setBookingModal(false);

      if (socketRef.current) {
        joinBookingRoom(socketRef.current, newBooking._id);
      }
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setNotification({
        id: Date.now().toString(),
        title: err.title,
        body: err.message,
        type: 'error',
      });
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
      setNotification({
        id: Date.now().toString(),
        title: 'Duty Offline',
        body: 'You are now offline and will not receive passenger ride requests.',
        type: 'info',
      });
    } else {
      try {
        if (socketRef.current) {
          setDriverDutyStatus(socketRef.current, 'AVAILABLE');
          const cleanup = await startDriverTracking(
            socketRef.current,
            (st) => setTrackerStatus(st),
            (loc) => {
              setDeviceLocation(loc);
              setDriverLiveLoc((prev) => ({
                ...(prev || {}),
                driverId: 'self',
                latitude: loc.latitude,
                longitude: loc.longitude,
                heading: loc.heading,
                speed: loc.speed,
                updatedAt: new Date().toISOString(),
              } as DriverLiveLocation));
            }
          );
          trackerCleanupRef.current = cleanup;
          setIsDriverOnline(true);
          setNotification({
            id: Date.now().toString(),
            title: 'Duty Online',
            body: 'Live GPS broadcast active. Ready for passenger dispatches.',
            type: 'success',
          });
        }
      } catch (err: any) {
        const errorInfo = formatUnifiedError(err);
        setNotification({
          id: Date.now().toString(),
          title: errorInfo.title,
          body: errorInfo.message,
          type: 'error',
        });
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
      setNotification({
        id: Date.now().toString(),
        title: 'Ride Accepted',
        body: 'Navigate to pickup location and request the 4-digit ride start PIN.',
        type: 'success',
      });
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setNotification({
        id: Date.now().toString(),
        title: err.title,
        body: err.message,
        type: 'error',
      });
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
      const err = formatUnifiedError(e);
      setNotification({
        id: Date.now().toString(),
        title: err.title,
        body: err.message,
        type: 'error',
      });
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
      setNotification({
        id: Date.now().toString(),
        title: 'Trip Started! 🚗',
        body: 'Drive safely to passenger drop-off location.',
        type: 'success',
      });
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setNotification({
        id: Date.now().toString(),
        title: 'PIN Verification Failed',
        body: err.message || 'Incorrect 4-digit ride start PIN.',
        type: 'error',
      });
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
        cancellationReason: 'User requested cancellation',
      });
      setActiveBooking(null);
      setBookingModal(false);
      setNotification({
        id: Date.now().toString(),
        title: 'Booking Cancelled',
        body: 'Your ride request has been cancelled.',
        type: 'info',
      });
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setNotification({
        id: Date.now().toString(),
        title: err.title,
        body: err.message,
        type: 'error',
      });
    }
  };

  // Compute Map Markers
  const markers: MapMarker[] = [];
  let routePolyline: RoutePolyline | undefined;

  // A. Self Device Location Marker
  if (deviceLocation) {
    markers.push({
      id: 'self-location',
      latitude: deviceLocation.latitude,
      longitude: deviceLocation.longitude,
      heading: deviceLocation.heading || 0,
      isVehicle: role === 'DRIVER',
      title:
        role === 'DRIVER'
          ? isDriverOnline
            ? 'You (Online & Available)'
            : 'You (Offline)'
          : 'Your Current Location',
      color: role === 'DRIVER' ? (isDriverOnline ? '#00D084' : '#64748B') : '#00D084',
    });
  }

  // B. Active Booking Markers & Route
  if (activeBooking) {
    if (activeBooking.pickupLocation?.coordinates) {
      markers.push({
        id: 'pickup',
        longitude: activeBooking.pickupLocation.coordinates[0],
        latitude: activeBooking.pickupLocation.coordinates[1],
        title: `Pickup: ${activeBooking.pickupAddress}`,
        color: '#00D084',
      });
    }

    if (activeBooking.dropLocation?.coordinates) {
      markers.push({
        id: 'drop',
        longitude: activeBooking.dropLocation.coordinates[0],
        latitude: activeBooking.dropLocation.coordinates[1],
        title: `Destination: ${activeBooking.dropAddress}`,
        color: '#EF4444',
      });
    }

    const dLat = driverLiveLoc?.latitude || activeBooking.driverLocation?.latitude;
    const dLon = driverLiveLoc?.longitude || activeBooking.driverLocation?.longitude;
    const dHeading = driverLiveLoc?.heading || activeBooking.driverLocation?.heading || 0;

    if (dLat && dLon) {
      markers.push({
        id: 'driver-assigned',
        latitude: dLat,
        longitude: dLon,
        title: 'Assigned Driver Partner',
        color: '#0F172A',
        heading: dHeading,
        isVehicle: true,
      });

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
  }

  // C. Owner Fleet Overview Markers
  if (role === 'OWNER' && drivers && drivers.length > 0) {
    drivers.forEach((d) => {
      markers.push({
        id: `fleet-${d.id}`,
        longitude: d.lng,
        latitude: d.lat,
        title: `${d.name} (${d.state})`,
        isVehicle: true,
        color: d.color,
      });
    });
  }

  // ==========================================
  // RENDER: 1. RIDER / CUSTOMER WORKSPACE
  // ==========================================
  if (role === 'CUSTOMER') {
    return (
      <View style={s.container}>
        <NotificationBanner
          notification={notification}
          onDismiss={() => setNotification(null)}
        />

        <View style={s.mapWrapper}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            route={routePolyline}
            style={s.mapFrame}
          />

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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My GPS Location"
            style={s.recenterFab}
            onPress={() => fetchCurrentLocation(true)}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#00D084" />
            ) : (
              <Icon name="locate" size={20} color="#00D084" />
            )}
          </Pressable>

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

        {activeBooking ? (
          <View style={s.activeRideSheet}>
            <View style={s.sheetHandle} />

            <View style={s.driverCard}>
              <View style={s.driverAvatarBox}>
                <Icon name="person" size={22} color="#FFFFFF" />
              </View>
              <View style={s.driverMeta}>
                <Text style={s.driverName}>
                  {typeof activeBooking.driverId === 'object' &&
                  activeBooking.driverId?.userId?.name
                    ? activeBooking.driverId.userId.name
                    : 'Assigned Driver Partner'}
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
                    ? 'At Pickup Point'
                    : 'Driver En Route'}
                </Text>
                <Text style={s.stepLabel}>
                  {activeBooking.status === 'TRIP_STARTED' ? 'Driving to Destination' : 'Dropoff'}
                </Text>
              </View>
            </View>

            <View style={s.sheetActions}>
              <Pressable
                style={s.callBtn}
                onPress={() => {
                  if (Platform.OS === 'web') window.alert('Calling driver: +91 98765 43210');
                  else Alert.alert('Contact Driver', 'Connecting to driver partner...');
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
                        <View style={s.tierIconBox}>
                          <Icon
                            name={tier.icon}
                            family={tier.iconFamily}
                            size={22}
                            color={isSelected ? '#00D084' : '#94A3B8'}
                          />
                        </View>
                        <View style={s.tierInfo}>
                          <Text style={s.tierName}>{tier.name}</Text>
                          <Text style={s.tierDesc}>{tier.desc}</Text>
                        </View>
                        <View style={s.tierPricing}>
                          <Text style={s.tierPrice}>{tier.price}</Text>
                          <Text style={s.tierEta}>{tier.eta}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={s.bookBtnContainer}>
                  <AppButton label="Confirm & Request Ride" onPress={handleRequestRide} />
                </View>
              </ScrollView>
            )}
          </View>
        )}

        <Modal visible={showRatingModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.ratingCard}>
              <View style={s.ratingHeader}>
                <Icon name="checkmark-circle" size={40} color="#00D084" />
                <Text style={s.ratingTitle}>Rate Your Driver Partner</Text>
                <Text style={s.ratingSub}>How was your ride experience today?</Text>
              </View>

              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setUserRating(star)} style={s.starBtn}>
                    <Icon
                      name={star <= userRating ? 'star' : 'star-outline'}
                      size={28}
                      color="#F59E0B"
                    />
                  </Pressable>
                ))}
              </View>

              <Text style={s.tipHeading}>ADD A DRIVER TIP</Text>
              <View style={s.tipsRow}>
                {[0, 30, 50, 100].map((amount) => (
                  <Pressable
                    key={amount}
                    style={[s.tipBtn, tipAmount === amount && s.tipBtnActive]}
                    onPress={() => setTipAmount(amount)}
                  >
                    <Text style={[s.tipText, tipAmount === amount && s.tipTextActive]}>
                      {amount === 0 ? 'No Tip' : `₹${amount}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AppButton label="Submit Feedback" onPress={handleSubmitRating} />
            </View>
          </View>
        </Modal>

        <ProfileModal
          visible={profileVisible}
          onClose={() => setProfileVisible(false)}
          onLogout={handleLogout}
          role={role}
        />
      </View>
    );
  }

  // ==========================================
  // RENDER: 2. DRIVER PARTNER WORKSPACE
  // ==========================================
  if (role === 'DRIVER') {
    return (
      <View style={s.container}>
        <NotificationBanner
          notification={notification}
          onDismiss={() => setNotification(null)}
        />

        <View style={s.mapWrapper}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            route={routePolyline}
            style={s.mapFrame}
          />

          <View style={s.mapTopRow}>
            <View style={s.brandBadge}>
              <Icon name="flash" size={14} color="#00D084" />
              <Text style={s.brandBadgeText}>DRIVER PORTAL</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              style={s.profileAvatarBtn}
              onPress={() => setProfileVisible(true)}
            >
              <Icon name="person" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My GPS Location"
            style={s.recenterFab}
            onPress={() => fetchCurrentLocation(true)}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#00D084" />
            ) : (
              <Icon name="locate" size={20} color="#00D084" />
            )}
          </Pressable>
        </View>

        {incomingBookingReq && (
          <View style={s.incomingOverlay}>
            <View style={s.incomingCard}>
              <View style={s.incomingTop}>
                <View style={s.incomingBadge}>
                  <Text style={s.incomingBadgeText}>NEW RIDE DISPATCH</Text>
                </View>
                <Text style={s.incomingTimerText}>{incomingTimer}s</Text>
              </View>

              <Text style={s.incomingFare}>₹{incomingBookingReq.fare}</Text>
              <Text style={s.incomingTier}>{incomingBookingReq.serviceTier || 'BlackSquad Express'}</Text>

              <View style={s.incomingLocations}>
                <View style={s.locRow}>
                  <View style={s.pickupPointDot} />
                  <Text style={s.locText} numberOfLines={1}>
                    {incomingBookingReq.pickupAddress}
                  </Text>
                </View>
                <View style={s.locRow}>
                  <View style={s.dropPointSquare} />
                  <Text style={s.locText} numberOfLines={1}>
                    {incomingBookingReq.dropAddress}
                  </Text>
                </View>
              </View>

              <View style={s.incomingActions}>
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
                  <Text style={s.tripKicker}>ACTIVE PASSENGER TRIP</Text>
                  <Text style={s.tripFare}>₹{activeBooking.fare}</Text>
                </View>
                <View style={s.statusPill}>
                  <Text style={s.statusPillText}>
                    {activeBooking.status === 'DRIVER_ACCEPTED'
                      ? 'Heading to Pickup'
                      : activeBooking.status === 'DRIVER_ARRIVING'
                      ? 'At Pickup Spot'
                      : activeBooking.status === 'TRIP_STARTED'
                      ? 'Trip in Progress'
                      : activeBooking.status}
                  </Text>
                </View>
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
                <Pressable
                  style={s.actionPrimaryBtn}
                  onPress={() => handleDriverStatusUpdate('DRIVER_ARRIVING')}
                >
                  <Text style={s.actionPrimaryText}>I HAVE ARRIVED AT PICKUP</Text>
                </Pressable>
              )}

              {activeBooking.status === 'DRIVER_ARRIVING' && (
                <Pressable
                  style={s.actionPrimaryBtn}
                  onPress={() => setShowOtpModal(true)}
                >
                  <Text style={s.actionPrimaryText}>VERIFY 4-DIGIT PIN & START TRIP</Text>
                </Pressable>
              )}

              {activeBooking.status === 'TRIP_STARTED' && (
                <Pressable
                  style={[s.actionPrimaryBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => handleDriverStatusUpdate('TRIP_COMPLETED')}
                >
                  <Text style={s.actionPrimaryText}>COMPLETE TRIP & COLLECT FARE</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={s.dutyContainer}>
              <View style={s.dutyHeader}>
                <View>
                  <Text style={s.dutyTitle}>
                    {isDriverOnline ? 'You are ONLINE' : 'You are OFFLINE'}
                  </Text>
                  <Text style={s.dutySub}>
                    {isDriverOnline
                      ? 'Live GPS broadcasting • Ready for dispatches'
                      : 'Go online to start receiving passenger rides'}
                  </Text>
                </View>
                <View
                  style={[
                    s.dutyStatusDot,
                    { backgroundColor: isDriverOnline ? '#00D084' : '#64748B' },
                  ]}
                />
              </View>

              {isDriverOnline && deviceLocation && (
                <View style={s.telemetryCard}>
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>GPS SPEED</Text>
                    <Text style={s.telemetryValue}>
                      {Math.round(deviceLocation.speed || 0)} km/h
                    </Text>
                  </View>
                  <View style={s.telemetryDivider} />
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>HEADING</Text>
                    <Text style={s.telemetryValue}>
                      {Math.round(deviceLocation.heading || 0)}°
                    </Text>
                  </View>
                  <View style={s.telemetryDivider} />
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>TRACKER</Text>
                    <Text style={[s.telemetryValue, { color: '#00D084' }]}>LIVE</Text>
                  </View>
                </View>
              )}

              <Pressable
                style={[
                  s.toggleDutyBtn,
                  isDriverOnline ? s.toggleDutyBtnOffline : s.toggleDutyBtnOnline,
                ]}
                onPress={handleToggleDuty}
              >
                <Icon
                  name={isDriverOnline ? 'power' : 'radio'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={s.toggleDutyBtnText}>
                  {isDriverOnline ? 'GO OFFLINE' : 'GO ONLINE & ACCEPT RIDES'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Modal visible={showOtpModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.otpModalCard}>
              <View style={s.otpHeader}>
                <Icon name="key" size={32} color="#00D084" />
                <Text style={s.otpModalTitle}>Enter Rider PIN</Text>
                <Text style={s.otpModalSub}>
                  Ask passenger for their 4-digit ride start PIN
                </Text>
              </View>

              <TextInput
                style={s.otpInputBox}
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="• • • •"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />

              <View style={s.otpActions}>
                <Pressable
                  style={s.otpCancelBtn}
                  onPress={() => setShowOtpModal(false)}
                >
                  <Text style={s.otpCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={s.otpSubmitBtn}
                  onPress={handleVerifyOtpAndStart}
                >
                  <Text style={s.otpSubmitText}>Verify & Start Trip</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <ProfileModal
          visible={profileVisible}
          onClose={() => setProfileVisible(false)}
          onLogout={handleLogout}
          role={role}
        />
      </View>
    );
  }

  // ==========================================
  // RENDER: 3. FLEET OPERATIONS OWNER WORKSPACE
  // ==========================================
  return (
    <View style={s.container}>
      <NotificationBanner
        notification={notification}
        onDismiss={() => setNotification(null)}
      />

      <View style={s.mapWrapper}>
        <MapView
          center={mapCenter}
          zoom={mapZoom}
          markers={markers}
          style={s.mapFrame}
        />

        <View style={s.mapTopRow}>
          <View style={s.brandBadge}>
            <Icon name="business" size={14} color="#F59E0B" />
            <Text style={s.brandBadgeText}>FLEET OPERATIONS</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              style={[s.profileAvatarBtn, { backgroundColor: '#10B981', borderColor: '#059669', width: 'auto', paddingHorizontal: 12 }]}
              onPress={() => setAnalyticsVisible(true)}
            >
              <Icon name="stats-chart" size={15} color="#07100D" />
              <Text style={{ color: '#07100D', fontSize: 12, fontWeight: '900', marginLeft: 4 }}>Revenue</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={s.profileAvatarBtn}
              onPress={() => setProfileVisible(true)}
            >
              <Icon name="person" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My GPS Location"
          style={s.recenterFab}
          onPress={() => fetchCurrentLocation(true)}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#00D084" />
          ) : (
            <Icon name="locate" size={20} color="#00D084" />
          )}
        </Pressable>
      </View>

      <View style={s.ownerSheet}>
        <View style={s.sheetHandle} />

        {/* Fleet Revenue & Analytics Banner Action */}
        <Pressable
          style={s.ownerAnalyticsBanner}
          onPress={() => setAnalyticsVisible(true)}
        >
          <View style={s.analyticsBannerIconBox}>
            <Icon name="trending-up" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.analyticsBannerTitle}>Fleet Revenue & Expenses</Text>
            <Text style={s.analyticsBannerSub}>Weekly earnings charts, fuel logs & driver payouts</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#10B981" />
        </Pressable>

        <View style={s.ownerHeader}>
          <Text style={s.ownerTitle}>Active Vehicle Fleet</Text>
          <Text style={s.ownerSub}>
            {drivers ? `${drivers.length} total vehicles linked` : 'Loading fleet radar...'}
          </Text>
        </View>

        <ScrollView style={s.fleetScroll} showsVerticalScrollIndicator={false}>
          {drivers && drivers.length > 0 ? (
            drivers.map((driver) => (
              <Pressable
                key={driver.id}
                style={s.fleetCard}
                onPress={() => {
                  setSelectedDriver(driver);
                  setMapCenter({
                    latitude: driver.lat,
                    longitude: driver.lng,
                  });
                }}
              >
                <View
                  style={[
                    s.fleetAvatar,
                    {
                      backgroundColor: `${driver.color}22`,
                    },
                  ]}
                >
                  <Icon
                    name="car-sport"
                    size={20}
                    color={driver.color}
                  />
                </View>

                <View style={s.fleetMeta}>
                  <Text style={s.fleetName}>{driver.name}</Text>
                  <Text style={s.fleetVehicle}>
                    {driver.vehicle}
                  </Text>
                </View>

                <View style={s.fleetStatusGroup}>
                  <View
                    style={[
                      s.statusPill,
                      {
                        backgroundColor: `${driver.color}22`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.statusPillText,
                        {
                          color: driver.color,
                        },
                      ]}
                    >
                      {driver.state}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={s.emptyFleet}>
              <Icon name="cube" size={32} color="#64748B" />
              <Text style={s.emptyFleetText}>No drivers currently online in fleet radar</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <FleetAnalyticsModal
        visible={analyticsVisible}
        onClose={() => setAnalyticsVisible(false)}
        onShowNotification={(title, body, type) =>
          setNotification({
            id: Date.now().toString(),
            title,
            body,
            type,
          })
        }
      />

      <DriverDetailModal
        visible={Boolean(selectedDriver)}
        driver={selectedDriver}
        onClose={() => setSelectedDriver(null)}
      />

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onLogout={handleLogout}
        role={role}
      />
    </View>
  );
}

const s = StyleSheet.create<{
  container: ViewStyle;
  mapWrapper: ViewStyle;
  mapFrame: ViewStyle;
  mapTopRow: ViewStyle;
  brandBadge: ViewStyle;
  brandBadgeText: TextStyle;
  profileAvatarBtn: ViewStyle;
  recenterFab: ViewStyle;
  floatingEtaPill: ViewStyle;
  floatingEtaText: TextStyle;
  bookingSheet: ViewStyle;
  activeRideSheet: ViewStyle;
  driverControlSheet: ViewStyle;
  ownerSheet: ViewStyle;
  ownerAnalyticsBanner: ViewStyle;
  analyticsBannerIconBox: ViewStyle;
  analyticsBannerTitle: TextStyle;
  analyticsBannerSub: TextStyle;
  sheetHandle: ViewStyle;
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
  tierInfo: ViewStyle;
  tierName: TextStyle;
  tierDesc: TextStyle;
  tierPricing: ViewStyle;
  tierPrice: TextStyle;
  tierEta: TextStyle;
  bookBtnContainer: ViewStyle;
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
  dutyContainer: ViewStyle;
  dutyHeader: ViewStyle;
  dutyTitle: TextStyle;
  dutySub: TextStyle;
  dutyStatusDot: ViewStyle;
  telemetryCard: ViewStyle;
  telemetryItem: ViewStyle;
  telemetryLabel: TextStyle;
  telemetryValue: TextStyle;
  telemetryDivider: ViewStyle;
  toggleDutyBtn: ViewStyle;
  toggleDutyBtnOnline: ViewStyle;
  toggleDutyBtnOffline: ViewStyle;
  toggleDutyBtnText: TextStyle;
  incomingOverlay: ViewStyle;
  incomingCard: ViewStyle;
  incomingTop: ViewStyle;
  incomingBadge: ViewStyle;
  incomingBadgeText: TextStyle;
  incomingTimerText: TextStyle;
  incomingFare: TextStyle;
  incomingTier: TextStyle;
  incomingLocations: ViewStyle;
  locRow: ViewStyle;
  locText: TextStyle;
  incomingActions: ViewStyle;
  declineBtn: ViewStyle;
  declineBtnText: TextStyle;
  acceptBtn: ViewStyle;
  acceptBtnText: TextStyle;
  activeTripContent: ViewStyle;
  tripHeader: ViewStyle;
  tripKicker: TextStyle;
  tripFare: TextStyle;
  statusPill: ViewStyle;
  statusPillText: TextStyle;
  tripLocations: ViewStyle;
  actionPrimaryBtn: ViewStyle;
  actionPrimaryText: TextStyle;
  modalOverlay: ViewStyle;
  otpModalCard: ViewStyle;
  otpHeader: ViewStyle;
  otpModalTitle: TextStyle;
  otpModalSub: TextStyle;
  otpInputBox: TextStyle;
  otpActions: ViewStyle;
  otpCancelBtn: ViewStyle;
  otpCancelText: TextStyle;
  otpSubmitBtn: ViewStyle;
  otpSubmitText: TextStyle;
  ratingCard: ViewStyle;
  ratingHeader: ViewStyle;
  ratingTitle: TextStyle;
  ratingSub: TextStyle;
  starsRow: ViewStyle;
  starBtn: ViewStyle;
  tipHeading: TextStyle;
  tipsRow: ViewStyle;
  tipBtn: ViewStyle;
  tipBtnActive: ViewStyle;
  tipText: TextStyle;
  tipTextActive: TextStyle;
  ownerHeader: ViewStyle;
  ownerTitle: TextStyle;
  ownerSub: TextStyle;
  fleetScroll: ViewStyle;
  fleetCard: ViewStyle;
  fleetAvatar: ViewStyle;
  fleetMeta: ViewStyle;
  fleetName: TextStyle;
  fleetVehicle: TextStyle;
  fleetStatusGroup: ViewStyle;
  emptyFleet: ViewStyle;
  emptyFleetText: TextStyle;
}>({
  container: {
    flex: 1,
    backgroundColor: '#07100D',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  mapFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mapTopRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  recenterFab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.4)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 15,
  },
  floatingEtaPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 88,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.3)',
    zIndex: 15,
  },
  floatingEtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  bookingSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeRideSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  driverControlSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ownerSheet: {
    height: '42%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  searchNowBtn: {
    backgroundColor: '#00D084',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  searchNowText: {
    color: '#07100D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bookingFormScroll: {
    maxHeight: 380,
  },
  bookingFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  inputsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
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
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 10,
    marginLeft: 18,
  },
  addressInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  tiersHeading: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 10,
  },
  tiersList: {
    gap: 10,
    marginBottom: 16,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  tierCardActive: {
    borderColor: '#00D084',
    backgroundColor: '#132A22',
  },
  tierIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  tierDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  tierPricing: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  tierEta: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  bookBtnContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  driverAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  driverVehicle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  otpBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D084',
  },
  otpLabel: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otpCode: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tripStatusBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  statusStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
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
  },
  stepLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  dutyContainer: {
    gap: 14,
  },
  dutyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dutyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  dutySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  dutyStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  telemetryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleDutyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  toggleDutyBtnOnline: {
    backgroundColor: '#00D084',
  },
  toggleDutyBtnOffline: {
    backgroundColor: '#EF4444',
  },
  toggleDutyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  incomingOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    zIndex: 30,
  },
  incomingCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#00D084',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  incomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  incomingBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  incomingBadgeText: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  incomingTimerText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
  },
  incomingFare: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  incomingTier: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
  },
  incomingLocations: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
  },
  declineBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D084',
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptBtnText: {
    color: '#07100D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeTripContent: {
    gap: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripKicker: {
    color: '#00D084',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  tripFare: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statusPill: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    color: '#00D084',
    fontSize: 11,
    fontWeight: '800',
  },
  tripLocations: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  actionPrimaryBtn: {
    backgroundColor: '#00D084',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionPrimaryText: {
    color: '#07100D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  otpModalSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  otpInputBox: {
    width: 180,
    height: 52,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    color: '#00D084',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#00D084',
    marginBottom: 20,
  },
  otpActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  otpCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  otpSubmitBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D084',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpSubmitText: {
    color: '#07100D',
    fontSize: 13,
    fontWeight: '900',
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  ratingSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  starBtn: {
    padding: 4,
  },
  tipHeading: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  tipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tipBtnActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  tipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  tipTextActive: {
    color: '#00D084',
  },
  ownerAnalyticsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginBottom: 16,
  },
  analyticsBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsBannerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  analyticsBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  ownerHeader: {
    marginBottom: 12,
  },
  ownerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  ownerSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  fleetScroll: {
    flex: 1,
  },
  fleetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  fleetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetMeta: {
    flex: 1,
  },
  fleetName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  fleetVehicle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  fleetStatusGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  emptyFleet: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyFleetText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
