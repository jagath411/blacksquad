import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { Card, Input } from '../components/ui';
import { MapView, type MapMarker } from '../components/MapView';
import { ProfileModal } from '../components/ProfileModal';
import { DriverDetailModal, type DriverDetailData } from '../components/DriverDetailModal';
import { NotificationBanner, type NotificationItem } from '../components/NotificationBanner';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';
import type { RootStackParamList, UserRole } from '../types';
import { createFleetSocket } from '../services/socket';
import { startDriverTracking, type TrackerStatus } from '../services/driverTracker';
import { useFleet } from '../hooks/useFleet';
import { clearAccessToken } from '../services/tokenStore';
import {
  createBooking,
  getActiveBooking,
  acceptBooking,
  updateBookingStatus,
  type BookingData,
  type BookingStatus,
} from '../services/bookingService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface RideTier {
  id: string;
  name: string;
  eta: string;
  price: string;
  desc: string;
  icon: string;
}

const RIDE_TIERS: RideTier[] = [
  { id: 'uberx', name: 'BlackSquad Express', eta: '3 mins away', price: '₹280', desc: 'Fast, comfortable city rides', icon: '🚗' },
  { id: 'comfort', name: 'Fleet Comfort Van', eta: '5 mins away', price: '₹450', desc: 'Extra space for group & luggage', icon: '🚐' },
  { id: 'heavy', name: 'Heavy Freight Hauler', eta: '8 mins away', price: '₹950', desc: 'Commercial transport & logistics', icon: '🚛' },
];

export function HomeScreen({ route, navigation }: Props) {
  const role: UserRole = route.params.role;
  const [profileVisible, setProfileVisible] = useState(false);
  const [pickup, setPickup] = useState('Current location (BLR Tech Park)');
  const [destination, setDestination] = useState('');
  const [selectedTier, setSelectedTier] = useState('uberx');
  const [bookingModal, setBookingModal] = useState(false);
  const [matchedDriver, setMatchedDriver] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<BookingData | null>(null);
  const [notification, setNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    getActiveBooking().then((b) => setActiveBooking(b)).catch(() => {});
    const interval = setInterval(() => {
      getActiveBooking().then((b) => {
        if (b && b.status !== activeBooking?.status) {
          setNotification({
            id: Date.now().toString(),
            title: 'Trip Update',
            body: `Status changed to: ${b.status}`,
          });
        }
        setActiveBooking(b);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBooking?.status]);

  const handleLogout = async () => {
    await clearAccessToken();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Role' }],
    });
  };

  const handleBookRide = async () => {
    if (!destination.trim()) return;
    setBookingModal(true);
    setMatchedDriver(null);
    try {
      const b = await createBooking({
        pickupAddress: pickup,
        dropAddress: destination,
        pickupCoordinates: [77.5946, 12.9716],
        dropCoordinates: [77.6000, 12.9800],
        serviceTier: selectedTier,
        fare: selectedTier === 'heavy' ? 950 : selectedTier === 'comfort' ? 450 : 280,
      });
      setActiveBooking(b);
      setNotification({
        id: Date.now().toString(),
        title: 'Ride Request Submitted',
        body: 'Searching for nearest available driver nearby...',
      });
      setTimeout(() => {
        setMatchedDriver('Driver Test (KA-01-EQ-9999)');
      }, 2000);
    } catch {
      setMatchedDriver('Driver Test (KA-01-EQ-9999)');
    }
  };

  if (role === 'OWNER') {
    return <OwnerHome onLogout={handleLogout} openProfile={() => setProfileVisible(true)} profileModal={<ProfileModal visible={profileVisible} role={role} onClose={() => setProfileVisible(false)} onLogout={handleLogout} />} />;
  }

  if (role === 'DRIVER') {
    return <DriverHome onLogout={handleLogout} openProfile={() => setProfileVisible(true)} profileModal={<ProfileModal visible={profileVisible} role={role} onClose={() => setProfileVisible(false)} onLogout={handleLogout} />} />;
  }

  return (
    <Screen tone="dark" scroll={false} padded={false} decorative={false}>
      <NotificationBanner notification={notification} onDismiss={() => setNotification(null)} />
      <View style={styles.customerRoot}>
        {/* Top Map Surface */}
        <View style={styles.mapSurface} accessibilityLabel="Map preview">
          <MapView
            styleMode="dark"
            center={{ latitude: 12.9716, longitude: 77.5946 }}
            zoom={13}
            markers={[
              { id: 'user-loc', latitude: 12.9716, longitude: 77.5946, color: '#2563EB', title: 'Pickup Point', badgeText: '📍' },
              { id: 'nearby-driver', latitude: 12.9780, longitude: 77.5990, color: '#16A34A', title: 'Available Driver', badgeText: '🚗' },
            ]}
            style={styles.mapFrame}
          />

          {/* Header Bar */}
          <View style={styles.mapTopRow}>
            <View>
              <Text style={styles.kicker}>CUSTOMER MODE</Text>
              <Text style={styles.mapTitle}>Where to?</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                style={styles.avatarBtn}
                onPress={() => setProfileVisible(true)}
              >
                <Text style={styles.avatarBtnText}>👤 Profile</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Bottom Sheet Booking Drawer */}
        <Card tone="light" variant="elevated" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>Request a Ride</Text>
            <Text style={styles.sheetSubtitle}>Choose pickup & destination</Text>

            {/* Input Route Fields */}
            <View style={styles.routeFields}>
              <View style={styles.routeLine}>
                <View style={[styles.routeDot, styles.pickupDot]} />
                <View style={styles.connector} />
                <View style={[styles.routeDot, styles.destinationDot]} />
              </View>
              <View style={styles.inputs}>
                <Input tone="light" value={pickup} onChangeText={setPickup} placeholder="Pickup location" accessibilityLabel="Pickup location" />
                <Input tone="light" value={destination} onChangeText={setDestination} placeholder="Where to?" accessibilityLabel="Destination" returnKeyType="done" />
              </View>
            </View>

            {/* Quick Destination Chips */}
            <View style={styles.quickRow}>
              <Pressable style={styles.quickAction} onPress={() => setDestination('BLR Airport Terminal 1')}>
                <Text style={styles.quickIcon}>✈</Text>
                <Text style={styles.quickText}>Airport</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => setDestination('Central Railway Station')}>
                <Text style={styles.quickIcon}>🚆</Text>
                <Text style={styles.quickText}>Station</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => setDestination('MG Road Metro Hub')}>
                <Text style={styles.quickIcon}>🏢</Text>
                <Text style={styles.quickText}>Tech Park</Text>
              </Pressable>
            </View>

            {/* Service Tier Selection */}
            {destination.trim() ? (
              <View style={styles.tierSection}>
                <Text style={styles.tierHeading}>Available Transport Tiers</Text>
                {RIDE_TIERS.map((tier) => {
                  const selected = selectedTier === tier.id;
                  return (
                    <Pressable
                      key={tier.id}
                      style={[styles.tierCard, selected && styles.selectedTierCard]}
                      onPress={() => setSelectedTier(tier.id)}
                    >
                      <Text style={styles.tierIcon}>{tier.icon}</Text>
                      <View style={styles.tierInfo}>
                        <View style={styles.tierHeaderRow}>
                          <Text style={styles.tierName}>{tier.name}</Text>
                          <Text style={styles.tierPrice}>{tier.price}</Text>
                        </View>
                        <Text style={styles.tierDesc}>{tier.desc} • <Text style={styles.etaText}>{tier.eta}</Text></Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <AppButton
              label={destination.trim() ? `Confirm ${RIDE_TIERS.find(t => t.id === selectedTier)?.name}` : 'Enter Destination'}
              disabled={!destination.trim()}
              style={styles.button}
              onPress={handleBookRide}
            />
          </ScrollView>
        </Card>
      </View>

      {/* Ride Booking Simulation Modal */}
      <Modal visible={bookingModal} animationType="fade" transparent onRequestClose={() => setBookingModal(false)}>
        <View style={styles.bookingOverlay}>
          <View style={styles.bookingBox}>
            {!matchedDriver ? (
              <>
                <View style={styles.radarPulse} />
                <Text style={styles.bookingTitle}>Searching for Nearest Driver...</Text>
                <Text style={styles.bookingSub}>Connecting with available transport nearby in Bengaluru</Text>
              </>
            ) : (
              <>
                <Text style={styles.successBadge}>✓ Driver Assigned</Text>
                <Text style={styles.bookingTitle}>Driver is En Route!</Text>
                <Text style={styles.driverMatchedName}>{matchedDriver}</Text>
                <Text style={styles.bookingSub}>Estimated Arrival: 3 mins • Map updates live</Text>
                <AppButton label="Done" style={{ marginTop: spacing.md }} onPress={() => setBookingModal(false)} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <ProfileModal
        visible={profileVisible}
        role={role}
        onClose={() => setProfileVisible(false)}
        onLogout={handleLogout}
      />
    </Screen>
  );
}

function DriverHome({ onLogout, openProfile, profileModal }: { onLogout: () => void; openProfile: () => void; profileModal: React.ReactNode }) {
  const [status, setStatus] = useState<TrackerStatus>('offline');
  const [stop, setStop] = useState<(() => void) | undefined>();
  const [error, setError] = useState('');
  const [incomingTrip, setIncomingTrip] = useState<boolean>(false);
  const [activeBooking, setActiveBooking] = useState<BookingData | null>(null);

  useEffect(() => () => { stop?.(); }, [stop]);

  useEffect(() => {
    getActiveBooking().then((b) => setActiveBooking(b)).catch(() => {});
    const interval = setInterval(() => {
      getActiveBooking().then((b) => setActiveBooking(b)).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (nextStatus: BookingStatus) => {
    if (!activeBooking) return;
    try {
      const updated = await updateBookingStatus(activeBooking._id, nextStatus);
      setActiveBooking(updated.status === 'TRIP_COMPLETED' || updated.status === 'CANCELLED' ? null : updated);
    } catch {
      setActiveBooking(null);
    }
  };

  const toggle = async () => {
    if (stop) { stop(); setStop(undefined); setStatus('offline'); return; }
    try { const socket = await createFleetSocket(); const cleanup = await startDriverTracking(socket, setStatus); setStop(() => () => { cleanup(); socket.close(); }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start location tracking'); setStatus('error'); }
  };

  const online = status === 'online' || status === 'requesting';

  return (
    <Screen tone="dark" scroll>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>DRIVER CONSOLE</Text>
          <Text style={styles.title}>Ready for Duty?</Text>
        </View>
        <Pressable style={styles.avatarBtn} onPress={openProfile}>
          <Text style={styles.avatarBtnText}>👤 Profile & Bank</Text>
        </Pressable>
      </View>

      {/* Active Trip Navigation Card if Trip in Progress */}
      {activeBooking ? (
        <Card tone="dark" variant="outlined" style={{ marginBottom: spacing.lg, borderColor: '#38BDF8', borderWidth: 2 }}>
          <Text style={styles.cardTitle}>🚗 Active Trip in Progress</Text>
          <Text style={styles.body}>Pickup: {activeBooking.pickupAddress}</Text>
          <Text style={styles.body}>Dropoff: {activeBooking.dropAddress}</Text>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>Trip Status</Text>
            <Text style={styles.earningValue}>{activeBooking.status}</Text>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {activeBooking.status === 'DRIVER_ACCEPTED' || activeBooking.status === 'ASSIGNED' ? (
              <AppButton label="📍 I've Arrived at Pickup" onPress={() => handleStatusChange('DRIVER_ARRIVING')} />
            ) : activeBooking.status === 'DRIVER_ARRIVING' ? (
              <AppButton label="🚀 Start Trip Transit" onPress={() => handleStatusChange('TRIP_STARTED')} />
            ) : activeBooking.status === 'TRIP_STARTED' ? (
              <AppButton label="🏁 Complete Trip & Settle" onPress={() => handleStatusChange('TRIP_COMPLETED')} />
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Online Duty Card */}
      <Card tone="dark" variant="outlined" style={{ marginBottom: spacing.lg }}>
        <Text style={styles.cardTitle}>Live Location & Dispatch</Text>
        <Text style={styles.body}>Your transport owner can see your location while you are online. Payouts settle to your registered bank account.</Text>

        <View style={styles.trackerStatus}>
          <View style={[styles.statusDot, { backgroundColor: online ? '#4ADE80' : '#94A3B8' }]} />
          <Text style={styles.trackerStatusText}>
            {status === 'requesting' ? 'Requesting location permission…' : status === 'online' ? 'Online • Ready for Rides' : status === 'denied' ? 'Location permission denied' : status === 'error' ? 'Connection error' : 'Offline'}
          </Text>
        </View>

        {error && <Text style={styles.trackerError}>{error}</Text>}

        <AppButton label={online ? 'Go Offline' : 'Go Online for Trips'} variant={online ? 'secondary' : 'primary'} style={styles.button} onPress={toggle} />
      </Card>

      {/* Trip Simulation Trigger */}
      <Card tone="dark" variant="outlined">
        <Text style={styles.cardTitle}>Dispatch Simulation</Text>
        <Text style={styles.body}>Simulate receiving an incoming rider request to test the driver acceptance workflow.</Text>
        <AppButton label="⚡ Simulate Incoming Trip Alert" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => setIncomingTrip(true)} />
      </Card>

      {/* Incoming Trip Request Alert Sheet */}
      <Modal visible={incomingTrip} animationType="slide" transparent onRequestClose={() => setIncomingTrip(false)}>
        <View style={styles.bookingOverlay}>
          <View style={styles.tripAlertBox}>
            <Text style={styles.tripAlertSub}>Pickup: Indiranagar 100ft Rd (2.4 km away)</Text>
            <View style={styles.earningRow}>
              <Text style={styles.earningLabel}>Estimated Fare Earnings</Text>
              <Text style={styles.earningValue}>₹380.00</Text>
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <AppButton label="Accept Trip Request" onPress={() => setIncomingTrip(false)} />
              <Pressable style={styles.declineBtn} onPress={() => setIncomingTrip(false)}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {profileModal}
    </Screen>
  );
}

function OwnerHome({ onLogout, openProfile, profileModal }: { onLogout: () => void; openProfile: () => void; profileModal: React.ReactNode }) {
  const { fleet: liveFleet, connection } = useFleet();
  const [selectedDriver, setSelectedDriver] = useState<DriverDetailData | null>(null);

  const fleet: DriverDetailData[] = liveFleet.map((driver) => {
    let name = driver.driverName;
    if (!name || /^[0-9a-fA-F]{24}$/.test(name)) {
      name = `Driver (${driver.driverId.slice(-4)})`;
    }
    return {
      id: driver.driverId,
      name,
      vehicle: `Last update ${new Date(driver.receivedAt).toLocaleTimeString()}`,
      state: driver.connection === 'online' ? 'Online' : 'Stale',
      color: driver.connection === 'online' ? '#16A34A' : '#D97706',
      latitude: driver.latitude,
      longitude: driver.longitude,
    };
  });

  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number }>({
    latitude: 12.9716,
    longitude: 77.5946,
  });

  useEffect(() => {
    if (fleet.length > 0 && mapCenter.latitude === 12.9716 && mapCenter.longitude === 77.5946) {
      setMapCenter({ latitude: fleet[0].latitude, longitude: fleet[0].longitude });
    }
  }, [fleet]);

  const driverMarkers: MapMarker[] = fleet.map((driver, index) => ({
    id: driver.name,
    latitude: driver.latitude,
    longitude: driver.longitude,
    title: `${driver.name} (${driver.state})`,
    color: driver.color,
    badgeText: `${index + 1}`,
  }));

  return (
    <Screen tone="light" scroll>
      <View style={styles.ownerHeader}>
        <View>
          <Text style={styles.ownerKicker}>OWNER FLEET CONSOLE</Text>
          <Text style={styles.ownerTitle}>Transport Fleet</Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.avatarBtnLight} onPress={openProfile}>
          <Text style={styles.avatarBtnLightText}>👤 Profile & Bank</Text>
        </Pressable>
      </View>

      {/* Fleet Overview Stats */}
      <View style={styles.ownerStats}>
        <View>
          <Text style={styles.statValue}>{fleet.length}</Text>
          <Text style={styles.statLabel}>Drivers</Text>
        </View>
        <View>
          <Text style={styles.statValue}>{fleet.filter((driver) => driver.state === 'Online').length}</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View>
          <Text style={styles.statValue}>{connection === 'connected' ? 'Live' : 'Offline'}</Text>
          <Text style={styles.statLabel}>Socket</Text>
        </View>
      </View>

      {/* Interactive MapLibre Live Fleet Map */}
      <Card tone="light" variant="outlined" style={styles.fleetMap}>
        <Text style={styles.sectionTitle}>Live Fleet Map</Text>
        <View style={styles.ownerMap}>
          <MapView styleMode="light" center={mapCenter} zoom={12} markers={driverMarkers} style={styles.mapFrame} />
          {fleet.length === 0 && (
            <Text style={styles.mapHint}>
              {connection === 'error' ? 'Sign in as an owner to connect to live tracking' : 'Waiting for driver locations…'}
            </Text>
          )}
        </View>
      </Card>

      {/* Driver List with Payout & Track Links */}
      <Text style={styles.sectionTitle}>Fleet Drivers ({fleet.length})</Text>
      <View style={styles.driverList}>
        {fleet.map((driver) => (
          <Pressable key={driver.name} onPress={() => setSelectedDriver(driver)}>
            <Card tone="light" compact variant="outlined">
              <View style={styles.driverRow}>
                <View style={[styles.statusDot, { backgroundColor: driver.color }]} />
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={[styles.driverState, { color: driver.color }]}>{driver.state}</Text>
                  <Text style={styles.payoutLink}>Details & Payouts →</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <DriverDetailModal
        driver={selectedDriver}
        onClose={() => setSelectedDriver(null)}
        onTrackOnMap={(lat, lng) => setMapCenter({ latitude: lat, longitude: lng })}
      />

      {profileModal}
    </Screen>
  );
}

const styles = StyleSheet.create<any>({
  customerRoot: { flex: 1, minHeight: '100%', backgroundColor: darkColors.background },
  mapSurface: { flex: 1, minHeight: 320, backgroundColor: '#DCEBDF', overflow: 'hidden', position: 'relative' },
  mapFrame: { position: 'absolute', width: '100%', height: '100%', borderWidth: 0 },
  mapTopRow: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  kicker: { color: darkColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  title: { ...typography.pageTitle, color: darkColors.text, marginTop: spacing.xs, marginBottom: 0 },
  mapTitle: { color: '#0F172A', fontSize: 28, lineHeight: 32, fontWeight: '800', marginTop: spacing.xs },
  headerRight: { flexDirection: 'row', gap: spacing.xs },
  avatarBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  avatarBtnText: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  avatarBtnLight: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  avatarBtnLightText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },
  sheet: { marginTop: -18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: spacing.sm, paddingBottom: spacing.xl, flex: 1 },
  sheetScroll: { flex: 1 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: lightColors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { ...typography.sectionTitle, color: lightColors.text },
  sheetSubtitle: { ...typography.secondary, color: lightColors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  routeFields: { flexDirection: 'row', gap: spacing.sm },
  routeLine: { width: 14, alignItems: 'center', paddingTop: 17, paddingBottom: 17 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#FFFFFF' },
  pickupDot: { borderColor: '#2563EB' },
  destinationDot: { borderColor: '#0F172A' },
  connector: { flex: 1, width: 1, backgroundColor: lightColors.borderStrong, marginVertical: 5 },
  inputs: { flex: 1, gap: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickAction: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: lightColors.border, backgroundColor: lightColors.surfaceSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  quickIcon: { color: lightColors.primary, fontSize: 14 },
  quickText: { color: lightColors.textSecondary, fontSize: 11, fontWeight: '700' },
  tierSection: { marginTop: spacing.lg, gap: spacing.sm },
  tierHeading: { color: '#0F172A', fontWeight: '800', fontSize: 14, marginBottom: 2 },
  tierCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', gap: spacing.md },
  selectedTierCard: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  tierIcon: { fontSize: 24 },
  tierInfo: { flex: 1 },
  tierHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierName: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  tierPrice: { color: '#2563EB', fontWeight: '800', fontSize: 15 },
  tierDesc: { color: '#64748B', fontSize: 11, marginTop: 2 },
  etaText: { color: '#16A34A', fontWeight: '700' },
  button: { marginTop: spacing.lg },
  cardTitle: { ...typography.cardTitle, color: darkColors.text, marginBottom: spacing.sm },
  body: { ...typography.body, color: darkColors.textSecondary, lineHeight: 22 },
  trackerStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  trackerStatusText: { color: darkColors.text, fontSize: 13, fontWeight: '700' },
  trackerError: { color: darkColors.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  ownerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  ownerKicker: { color: lightColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  ownerTitle: { color: lightColors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: spacing.xs },
  ownerStats: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: lightColors.surfaceSubtle, borderWidth: 1, borderColor: lightColors.border, marginBottom: spacing.xl },
  statValue: { color: lightColors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: lightColors.textSecondary, fontSize: 12, marginTop: spacing.xxs },
  fleetMap: { marginBottom: spacing.xl },
  sectionTitle: { color: lightColors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  ownerMap: { height: 230, overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#DCEBDF', position: 'relative' },
  mapHint: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', backgroundColor: '#FFFFFF', color: lightColors.textSecondary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, fontSize: 11 },
  driverList: { gap: spacing.sm },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  driverInfo: { flex: 1 },
  driverName: { color: lightColors.text, fontWeight: '700', fontSize: 15 },
  driverVehicle: { color: lightColors.textSecondary, fontSize: 12, marginTop: 2 },
  driverState: { fontSize: 12, fontWeight: '700' },
  payoutLink: { color: '#2563EB', fontSize: 11, fontWeight: '700' },
  bookingOverlay: { flex: 1, backgroundColor: 'rgba(7, 16, 13, 0.8)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  bookingBox: { width: '100%', maxWidth: 360, backgroundColor: '#0F172A', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  radarPulse: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: '#38BDF8', marginBottom: spacing.md },
  bookingTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  bookingSub: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
  successBadge: { color: '#34D399', fontWeight: '800', fontSize: 13, marginBottom: spacing.xs },
  driverMatchedName: { color: '#38BDF8', fontSize: 16, fontWeight: '800', marginVertical: spacing.xs },
  tripAlertBox: { width: '100%', maxWidth: 380, backgroundColor: '#0F172A', borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: '#334155', gap: spacing.sm },
  tripAlertTitle: { color: '#38BDF8', fontSize: 20, fontWeight: '800' },
  tripAlertSub: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  earningRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1E293B', padding: spacing.md, borderRadius: radius.md, marginVertical: spacing.xs },
  earningLabel: { color: '#94A3B8', fontSize: 13 },
  earningValue: { color: '#4ADE80', fontWeight: '800', fontSize: 16 },
  declineBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  declineText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
});


