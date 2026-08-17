import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MapMarker } from './MapView';
const CARTO_STYLE = { version: 8, sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenStreetMap CARTO' } }, layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }] } as any;
interface Props { center: { latitude: number; longitude: number }; zoom: number; markers: MapMarker[]; interactive: boolean; style?: StyleProp<ViewStyle>; }
export function NativeMapView({ center, zoom, markers, interactive, style }: Props) {
  return <Map style={[styles.map, style]} mapStyle={CARTO_STYLE} dragPan={interactive} touchZoom={interactive} touchRotate={interactive} touchPitch={false}><Camera center={[center.longitude, center.latitude]} zoom={zoom} duration={500} />{markers.map((marker) => <Marker key={marker.id} id={marker.id} lngLat={[marker.longitude, marker.latitude]}><View style={[styles.marker, { backgroundColor: marker.color || '#2563EB' }]}><Text style={styles.markerText}>{marker.badgeText || '•'}</Text></View></Marker>)}</Map>;
}
const styles = StyleSheet.create({ map: { flex: 1 }, marker: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4 }, markerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' } });

