import { createElement, useState } from 'react';
import { Pressable, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { Card, Input } from '../components/ui';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ route }: Props) {
  const driver = route.params.role === 'DRIVER';
  const [pickup, setPickup] = useState('Current location');
  const [destination, setDestination] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (driver) {
    return (
      <Screen tone="dark" scroll>
        <Text style={styles.kicker}>DRIVER MODE</Text>
        <Text style={styles.title}>Ready for the road?</Text>
        <Card tone="dark" variant="outlined">
          <Text style={styles.cardTitle}>Your driver workspace</Text>
          <Text style={styles.body}>Go online to receive nearby booking requests and share your live location securely.</Text>
          <AppButton label="Go online" style={styles.button} />
        </Card>
      </Screen>
    );
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
});
