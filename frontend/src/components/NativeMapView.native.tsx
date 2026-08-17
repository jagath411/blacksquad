import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MapMarker, RoutePolyline } from './MapView';

const CARTO_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: 'OpenStreetMap CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
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
      mapStyle={CARTO_STYLE}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={interactive}
      touchPitch={false}
    >
      <Camera center={[center.longitude, center.latitude]} zoom={zoom} duration={500} />
      {markers.map((marker) => {
        const isVehicle = marker.isVehicle;
        return (
          <Marker key={marker.id} id={marker.id} lngLat={[marker.longitude, marker.latitude]}>
            <View
              style={[
                styles.marker,
                isVehicle && styles.vehicleMarker,
                { backgroundColor: marker.color || (isVehicle ? '#0F172A' : '#2563EB') },
                marker.heading !== undefined && { transform: [{ rotate: `${marker.heading}deg` }] },
              ]}
            >
              <Text style={styles.markerText}>{marker.badgeText || (isVehicle ? '🚗' : '•')}</Text>
            </View>
          </Marker>
        );
      })}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  vehicleMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  markerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
