import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MapMarker, RoutePolyline } from './MapView';

interface Props {
  center: { latitude: number; longitude: number };
  zoom: number;
  markers: MapMarker[];
  route?: RoutePolyline;
  interactive: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NativeMapView({ center, markers, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.gridOverlay}>
        <View style={styles.centerBadge}>
          <Text style={styles.centerText}>📍 Lat: {center.latitude.toFixed(4)}, Lng: {center.longitude.toFixed(4)}</Text>
        </View>
        <View style={styles.markerRow}>
          {markers.map((m) => (
            <View key={m.id} style={[styles.markerChip, { borderColor: m.color || '#10B981' }]}>
              <Text style={styles.markerChipText}>{m.isVehicle ? '🚗' : '👤'} {m.title || m.id}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#07100D',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    padding: 16,
    alignItems: 'center',
  },
  centerBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  centerText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  markerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  markerChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  markerChipText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
});
