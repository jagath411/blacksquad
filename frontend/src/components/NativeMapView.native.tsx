import React from 'react';
import { Camera, Map, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './ui/Icon';
import type { MapMarker, RoutePolyline } from './MapView';

const ESRI_DARK_STYLE = {
  version: 8,
  sources: {
    esri_dark_base: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, OpenStreetMap contributors',
    },
    esri_dark_labels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0B1120' } },
    { id: 'esri-dark-base', type: 'raster', source: 'esri_dark_base', minzoom: 0, maxzoom: 19 },
    { id: 'esri-dark-labels', type: 'raster', source: 'esri_dark_labels', minzoom: 0, maxzoom: 19 },
  ],
} as any;

interface Props {
  center: { latitude: number; longitude: number };
  zoom: number;
  markers: MapMarker[];
  route?: RoutePolyline;
  interactive: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NativeMapView({ center, zoom, markers, interactive, style }: Props) {
  return (
    <Map
      style={[styles.map, style]}
      mapStyle={ESRI_DARK_STYLE}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={interactive}
      touchPitch={false}
    >
      <Camera center={[center.longitude, center.latitude]} zoom={zoom} duration={500} />
      <UserLocation animated accuracy heading minDisplacement={3} />
      {markers.map((marker) => {
        const isVehicle = marker.isVehicle;
        return (
          <Marker key={marker.id} id={marker.id} lngLat={[marker.longitude, marker.latitude]}>
            <View
              style={[
                styles.markerBase,
                isVehicle ? styles.vehicleMarker : styles.pointMarker,
                { backgroundColor: marker.color || (isVehicle ? '#0F172A' : '#2563EB') },
                marker.heading !== undefined && isVehicle && { transform: [{ rotate: `${marker.heading}deg` }] },
              ]}
            >
              {isVehicle ? (
                <Icon name="navigate" size={16} color="#00D084" />
              ) : (
                <View style={styles.centerDot} />
              )}
            </View>
          </Marker>
        );
      })}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerBase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  vehicleMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  pointMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
