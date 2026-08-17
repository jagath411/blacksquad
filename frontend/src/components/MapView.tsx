import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import { NativeMapView } from './NativeMapView';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  color?: string;
  badgeText?: string;
}
export interface MapViewProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  styleMode?: 'light' | 'dark' | 'voyager';
  markers?: MapMarker[];
  interactive?: boolean;
  style?: any;
}
const STYLES: Record<string, maplibregl.StyleSpecification> = {
  light: { version: 8, sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenStreetMap CARTO' } }, layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }] },
  dark: { version: 8, sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenStreetMap CARTO' } }, layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }] },
  voyager: { version: 8, sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenStreetMap CARTO' } }, layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }] },
};
export function MapView({ center = { latitude: 12.9716, longitude: 77.5946 }, zoom = 12, styleMode = 'light', markers = [], interactive = true, style }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;
    if (!document.getElementById('maplibre-gl-css')) { const link = document.createElement('link'); link.id = 'maplibre-gl-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'; document.head.appendChild(link); }
    const map = new maplibregl.Map({ container: containerRef.current, style: STYLES[styleMode] || STYLES.light, center: [center.longitude, center.latitude], zoom, interactive, attributionControl: false });
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;
    return () => { markerInstancesRef.current.forEach((marker) => marker.remove()); markerInstancesRef.current.clear(); map.remove(); mapRef.current = null; };
  }, [styleMode]);
  useEffect(() => { mapRef.current?.flyTo({ center: [center.longitude, center.latitude], zoom, duration: 700 }); }, [center.latitude, center.longitude, zoom]);
  useEffect(() => {
    if (!mapRef.current) return;
    const existing = markerInstancesRef.current;
    const nextIds = new Set(markers.map((marker) => marker.id));
    existing.forEach((marker, id) => { if (!nextIds.has(id)) { marker.remove(); existing.delete(id); } });
    markers.forEach((marker) => {
      const current = existing.get(marker.id);
      if (current) { current.setLngLat([marker.longitude, marker.latitude]); return; }
      const element = document.createElement('div');
      Object.assign(element.style, { backgroundColor: marker.color || '#2563EB', width: '30px', height: '30px', borderRadius: '15px', border: '2px solid #FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
      element.innerText = marker.badgeText || '•';
      const next = new maplibregl.Marker({ element }).setLngLat([marker.longitude, marker.latitude]);
      if (marker.title) next.setPopup(new maplibregl.Popup({ offset: 20 }).setText(marker.title));
      next.addTo(mapRef.current!);
      existing.set(marker.id, next);
    });
  }, [markers]);
  if (Platform.OS !== 'web') return <NativeMapView center={center} zoom={zoom} markers={markers} interactive={interactive} style={style} />;
  return <View style={[styles.container, style]}><div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} /></View>;
}
const styles = StyleSheet.create({ container: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' } });

