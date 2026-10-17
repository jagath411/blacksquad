import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as maplibreModule from 'maplibre-gl';
import { NativeMapView } from './NativeMapView';
import { MAP_STYLE_URL } from '../constants/map';
import { fonts } from '../theme/fonts';

const maplibregl: any = (maplibreModule as any).default || maplibreModule;

// The bundler cannot locate maplibre's web worker on its own, and without the worker vector
// tiles never render. Point it at the published worker for the installed version.
const MAPLIBRE_VERSION = '6.3.0';
if (Platform.OS === 'web' && typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl(`https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl-worker.mjs`);
}

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  color?: string;
  badgeText?: string;
  heading?: number;
  isVehicle?: boolean;
}

export interface RoutePolyline {
  coordinates: [number, number][];
  color?: string;
}

interface MapViewProps {
  center?: LocationCoordinate;
  zoom?: number;
  styleMode?: 'light' | 'dark';
  markers?: MapMarker[];
  route?: RoutePolyline;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MapView({
  center = { latitude: 12.9716, longitude: 77.5946 },
  zoom = 13,
  styleMode = 'dark',
  markers = [],
  route,
  interactive = true,
  style,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerInstancesRef = useRef<Map<string, any>>(new Map());
  const isUserInteractingRef = useRef<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      // Must match the installed maplibre-gl version.
      link.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
      document.head.appendChild(link);
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.longitude, center.latitude],
      zoom,
      minZoom: 2,
      maxZoom: 18.5,
      interactive,
      // OpenStreetMap data requires visible attribution.
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    return () => {
      markerInstancesRef.current.forEach((marker) => marker.remove());
      markerInstancesRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [styleMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [center.longitude, center.latitude],
      zoom: Math.min(zoom, 18.5),
      essential: true,
      duration: 600,
    });
  }, [center.latitude, center.longitude, zoom]);

  // Route Polyline Layer with Dual Casing & Auto-Bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || Platform.OS !== 'web') return;

    const sourceId = 'route-source';
    const casingLayerId = 'route-layer-casing';
    const mainLayerId = 'route-layer';

    const updateRoute = () => {
      if (!map.isStyleLoaded()) return;

      if (map.getLayer(mainLayerId)) map.removeLayer(mainLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (route && route.coordinates && route.coordinates.length > 1) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates,
            },
          },
        });

        // 1. Outer Dark Casing / Shadow Layer
        map.addLayer({
          id: casingLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 9,
            'line-opacity': 1,
          },
        });

        // 2. Inner Vibrant Polyline Layer
        map.addLayer({
          id: mainLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': route.color || '#1E8E5A',
            'line-width': 5,
            'line-opacity': 0.95,
          },
        });

        // 3. Smooth Camera Fit to Route
        try {
          const bounds = new maplibregl.LngLatBounds(route.coordinates[0], route.coordinates[0]);
          for (let i = 1; i < route.coordinates.length; i++) {
            bounds.extend(route.coordinates[i]);
          }
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 260, left: 40, right: 40 },
            duration: 900,
            maxZoom: 16,
          });
        } catch {
          // Keep current camera if bounds cannot be computed
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateRoute();
    } else {
      map.once('load', updateRoute);
    }
  }, [route]);

  // Markers update
  useEffect(() => {
    if (!mapRef.current) return;
    const existing = markerInstancesRef.current;
    const nextIds = new Set(markers.map((m) => m.id));

    existing.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    });

    markers.forEach((marker) => {
      const current = existing.get(marker.id);
      if (current) {
        current.setLngLat([marker.longitude, marker.latitude]);
        if (marker.heading !== undefined) {
          current.setRotation(marker.heading);
        }
        return;
      }

      const element = document.createElement('div');
      const isVehicle = marker.isVehicle;

      Object.assign(element.style, {
        backgroundColor: marker.color || (isVehicle ? '#FFFFFF' : '#2457D6'),
        width: isVehicle ? '36px' : '22px',
        height: isVehicle ? '36px' : '22px',
        borderRadius: isVehicle ? '18px' : '11px',
        border: '2px solid #FFFFFF',
        boxShadow: '0 4px 12px rgba(29, 35, 43, 0.45)',
        color: '#1D232B',
        fontFamily: fonts.w600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.3s ease',
      });

      if (isVehicle) {
        element.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E0A800" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;
      } else {
        element.innerHTML = `<div style="width:6px;height:6px;border-radius:3px;background:#fff"></div>`;
      }

      const next = new maplibregl.Marker({
        element,
        rotation: marker.heading || 0,
        rotationAlignment: 'map',
      }).setLngLat([marker.longitude, marker.latitude]);

      if (marker.title) {
        next.setPopup(new maplibregl.Popup({ offset: 20 }).setText(marker.title));
      }

      next.addTo(mapRef.current!);
      existing.set(marker.id, next);
    });
  }, [markers]);

  if (Platform.OS !== 'web') {
    return (
      <NativeMapView
        center={center}
        zoom={zoom}
        markers={markers}
        interactive={interactive}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.container, style]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
});
