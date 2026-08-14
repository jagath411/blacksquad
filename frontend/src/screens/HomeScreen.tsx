import { createElement, useEffect, useState } from 'react';
import { Pressable, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { Card, Input } from '../components/ui';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types';
import { createFleetSocket } from '../services/socket';
import { startDriverTracking, type TrackerStatus } from '../services/driverTracker';
import { useFleet } from '../hooks/useFleet';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ route }: Props) {
  const driver = route.params.role === 'DRIVER';
  const [pickup, setPickup] = useState('Current location');
  const [destination, setDestination] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (route.params.role === 'OWNER') {
    return <OwnerHome mapsKey={mapsKey} />;
  }

  if (driver) {
    return <DriverHome />;
  }

  return (
    <Screen tone="dark" scroll={false} padded={false} decorative={false}>
      <View style={styles.customerRoot}>
        <View style={styles.mapSurface} accessibilityLabel="Map preview">
          {Platform.OS === 'web' && mapsKey && createElement('iframe', {
            title: 'NashZero map',
            src: `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=12.9716,77.5946&zoom=13`,
            style: styles.mapFrame,
            loading: 'lazy',
            allowFullScreen: true,
          })}
          {!mapsKey && <View style={styles.mapGrid} />}
          <View style={styles.mapTopRow}>
            <View>
              <Text style={styles.kicker}>CUSTOMER MODE</Text>
              <Text style={styles.mapTitle}>Where are you going?</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={styles.avatar}><Text style={styles.avatarText}>JK</Text></Pressable>
          </View>
          <View style={styles.locationMarker}><View style={styles.markerDot} /></View>
          <View style={styles.mapLabel}><Text style={styles.mapLabelText}>Your location</Text></View>
          <View style={styles.mapControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Center map" style={styles.control}><Text style={styles.controlText}>⌖</Text></Pressable>
          </View>
        </View>

        <Card tone="light" variant="elevated" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Plan a trip</Text>
          <Text style={styles.sheetSubtitle}>Choose your pickup and destination</Text>
          <View style={styles.routeFields}>
            <View style={styles.routeLine}><View style={[styles.routeDot, styles.pickupDot]} /><View style={styles.connector} /><View style={[styles.routeDot, styles.destinationDot]} /></View>
            <View style={styles.inputs}>
              <Input tone="light" value={pickup} onChangeText={setPickup} placeholder="Pickup location" accessibilityLabel="Pickup location" />
              <Input tone="light" value={destination} onChangeText={setDestination} placeholder="Where to?" accessibilityLabel="Destination" returnKeyType="done" />
            </View>
          </View>
          <View style={styles.quickRow}>
            <Pressable accessibilityRole="button" style={styles.quickAction} onPress={() => setDestination('Home')}><Text style={styles.quickIcon}>⌂</Text><Text style={styles.quickText}>Home</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.quickAction} onPress={() => setDestination('Work')}><Text style={styles.quickIcon}>▣</Text><Text style={styles.quickText}>Work</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.quickAction} onPress={() => setShowDetails((value) => !value)}><Text style={styles.quickIcon}>＋</Text><Text style={styles.quickText}>More</Text></Pressable>
          </View>
          {showDetails && <Text style={styles.helper}>Google Maps search and live driver tracking will connect here once the Maps key is configured.</Text>}
          <AppButton label="Continue" disabled={!destination.trim()} style={styles.button} onPress={() => setShowDetails(true)} />
        </Card>
      </View>
    </Screen>
  );
}

function DriverHome() {
  const [status, setStatus] = useState<TrackerStatus>('offline');
  const [stop, setStop] = useState<(() => void) | undefined>();
  const [error, setError] = useState('');
  useEffect(() => () => { stop?.(); }, [stop]);
  const toggle = async () => {
    if (stop) { stop(); setStop(undefined); setStatus('offline'); return; }
    try { const socket = await createFleetSocket(); const cleanup = await startDriverTracking(socket, setStatus); setStop(() => () => { cleanup(); socket.close(); }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start location tracking'); setStatus('error'); }
  };
  const online = status === 'online' || status === 'requesting';
  return <Screen tone="dark" scroll><Text style={styles.kicker}>DRIVER MODE</Text><Text style={styles.title}>Ready for the road?</Text><Card tone="dark" variant="outlined"><Text style={styles.cardTitle}>Live location sharing</Text><Text style={styles.body}>Your transport owner can see your location only while you are online. Tracking continues during an active trip.</Text><View style={styles.trackerStatus}><View style={[styles.statusDot, { backgroundColor: online ? '#4ADE80' : '#94A3B8' }]} /><Text style={styles.trackerStatusText}>{status === 'requesting' ? 'Requesting permission…' : status === 'online' ? 'Online and sharing location' : status === 'denied' ? 'Location permission denied' : status === 'error' ? 'Unable to connect' : 'Offline'}</Text></View>{error && <Text style={styles.trackerError}>{error}</Text>}<AppButton label={online ? 'Go offline' : 'Go online'} variant={online ? 'secondary' : 'primary'} style={styles.button} onPress={toggle} /></Card></Screen>;
}

function OwnerHome({ mapsKey }: { mapsKey?: string }) {
  const { fleet: liveFleet, connection } = useFleet();
  const fleet = liveFleet.map((driver) => ({ name: driver.driverId, vehicle: `Last update ${new Date(driver.receivedAt).toLocaleTimeString()}`, state: driver.connection === 'online' ? 'Online' : 'Stale', color: driver.connection === 'online' ? '#16A34A' : '#D97706', latitude: driver.latitude, longitude: driver.longitude }));
  return (
    <Screen tone="light" scroll>
      <View style={styles.ownerHeader}><View><Text style={styles.ownerKicker}>OWNER CONSOLE</Text><Text style={styles.ownerTitle}>Good morning, Jagath</Text></View><View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>JK</Text></View></View>
      <View style={styles.ownerStats}><View><Text style={styles.statValue}>{fleet.length}</Text><Text style={styles.statLabel}>Drivers seen</Text></View><View><Text style={styles.statValue}>{fleet.filter((driver) => driver.state === 'Online').length}</Text><Text style={styles.statLabel}>Online</Text></View><View><Text style={styles.statValue}>{connection === 'connected' ? 'Live' : 'Offline'}</Text><Text style={styles.statLabel}>Socket</Text></View></View>
      <Card tone="light" variant="outlined" style={styles.fleetMap}><Text style={styles.sectionTitle}>Live fleet</Text><View style={styles.ownerMap}>{Platform.OS === 'web' && mapsKey ? createElement('iframe', { title: 'Owner fleet map', src: `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=12.9716,77.5946&zoom=11`, style: styles.mapFrame, loading: 'lazy', allowFullScreen: true }) : <View style={styles.ownerMapGrid} />}{fleet.slice(0, 8).map((driver, index) => <View key={driver.name} style={[styles.fleetMarker, { left: 25 + (index % 4) * 72, top: 45 + Math.floor(index / 4) * 65, backgroundColor: driver.color }]}><Text style={styles.fleetMarkerText}>{index + 1}</Text></View>)}{fleet.length === 0 && <Text style={styles.mapHint}>{connection === 'error' ? 'Sign in as an owner to connect to live tracking' : 'Waiting for driver locations…'}</Text>}{!mapsKey && fleet.length > 0 && <Text style={styles.mapHint}>Add Google Maps key for geographic map tiles</Text>}</View></Card>
      <Text style={styles.sectionTitle}>Driver status</Text>
      <View style={styles.driverList}>{fleet.map((driver) => <Card key={driver.name} tone="light" compact variant="outlined"><View style={styles.driverRow}><View style={[styles.statusDot, { backgroundColor: driver.color }]} /><View style={styles.driverInfo}><Text style={styles.driverName}>{driver.name}</Text><Text style={styles.driverVehicle}>{driver.vehicle}</Text></View><Text style={[styles.driverState, { color: driver.color }]}>{driver.state}</Text></View></Card>)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create<any>({
  customerRoot: { flex: 1, minHeight: '100%', backgroundColor: darkColors.background },
  mapSurface: { flex: 1, minHeight: 390, backgroundColor: '#DCEBDF', overflow: 'hidden', position: 'relative' },
  mapGrid: { ...StyleSheet.absoluteFill, opacity: 0.36, backgroundColor: '#C3D6C7', borderWidth: 18, borderColor: '#EAF2EA' },
  mapFrame: { position: 'absolute', width: '100%', height: '100%', borderWidth: 0 },
  mapTopRow: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: darkColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  title: { ...typography.pageTitle, color: darkColors.text, marginTop: spacing.sm, marginBottom: spacing.xl },
  mapTitle: { color: '#0F172A', fontSize: 30, lineHeight: 35, fontWeight: '800', marginTop: spacing.xs, maxWidth: 250 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: darkColors.surface, borderWidth: 1, borderColor: darkColors.border },
  avatarText: { color: darkColors.text, fontWeight: '800' },
  locationMarker: { position: 'absolute', top: 210, left: '50%', width: 34, height: 34, marginLeft: -17, borderRadius: 17, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#FFFFFF' },
  markerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  mapLabel: { position: 'absolute', top: 258, left: '50%', marginLeft: -45, backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  mapLabelText: { color: '#334155', fontSize: 11, fontWeight: '700' },
  mapControls: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  control: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  controlText: { color: '#1D4ED8', fontSize: 24 },
  sheet: { marginTop: -18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: spacing.sm, paddingBottom: spacing['2xl'] },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: lightColors.borderStrong, marginBottom: spacing.lg },
  sheetTitle: { ...typography.sectionTitle, color: lightColors.text },
  sheetSubtitle: { ...typography.secondary, color: lightColors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  routeFields: { flexDirection: 'row', gap: spacing.sm },
  routeLine: { width: 14, alignItems: 'center', paddingTop: 17, paddingBottom: 17 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#FFFFFF' },
  pickupDot: { borderColor: '#2563EB' },
  destinationDot: { borderColor: '#0F172A' },
  connector: { flex: 1, width: 1, backgroundColor: lightColors.borderStrong, marginVertical: 5 },
  inputs: { flex: 1, gap: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  quickAction: { flex: 1, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: lightColors.border, backgroundColor: lightColors.surfaceSubtle, alignItems: 'center', justifyContent: 'center', gap: 2 },
  quickIcon: { color: lightColors.primary, fontSize: 17, fontWeight: '800' },
  quickText: { color: lightColors.textSecondary, fontSize: 11, fontWeight: '700' },
  helper: { color: lightColors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  button: { marginTop: spacing.lg },
  cardTitle: { ...typography.cardTitle, color: darkColors.text, marginBottom: spacing.sm },
  body: { ...typography.body, color: darkColors.textSecondary, lineHeight: 23 },
  trackerStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  trackerStatusText: { color: darkColors.text, fontSize: 13, fontWeight: '700' },
  trackerError: { color: darkColors.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  ownerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  ownerKicker: { color: lightColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  ownerTitle: { color: lightColors.text, fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: spacing.xs },
  ownerBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: lightColors.primary, alignItems: 'center', justifyContent: 'center' },
  ownerBadgeText: { color: lightColors.textInverse, fontWeight: '800' },
  ownerStats: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: lightColors.surfaceSubtle, borderWidth: 1, borderColor: lightColors.border, marginBottom: spacing.xl },
  statValue: { color: lightColors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: lightColors.textSecondary, fontSize: 12, marginTop: spacing.xxs },
  fleetMap: { marginBottom: spacing.xl },
  sectionTitle: { color: lightColors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  ownerMap: { height: 220, overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#DCEBDF', position: 'relative' },
  ownerMapGrid: { ...StyleSheet.absoluteFill, opacity: 0.45, backgroundColor: '#C3D6C7', borderWidth: 18, borderColor: '#EAF2EA' },
  fleetMarker: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  fleetMarkerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  mapHint: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', backgroundColor: '#FFFFFF', color: lightColors.textSecondary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, fontSize: 11 },
  driverList: { gap: spacing.sm },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  driverInfo: { flex: 1 },
  driverName: { color: lightColors.text, fontWeight: '700', fontSize: 15 },
  driverVehicle: { color: lightColors.textSecondary, fontSize: 12, marginTop: 2 },
  driverState: { fontSize: 12, fontWeight: '700' },
});
