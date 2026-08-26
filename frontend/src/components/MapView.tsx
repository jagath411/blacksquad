import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as maplibreModule from 'maplibre-gl';
import { NativeMapView } from './NativeMapView';

const maplibregl: any = (maplibreModule as any).default || maplibreModule;

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

const STYLES: Record<string, any> = {
  light: {
    version: 8,
    sources: {
      esri_streets: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri, OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'bg-layer',
        type: 'background',
        paint: { 'background-color': '#F1F5F9' },
      },
      {
        id: 'esri-streets-tiles',
        type: 'raster',
        source: 'esri_streets',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  dark: {
    version: 8,
    sources: {
      esri_dark_base: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri, OpenStreetMap contributors',
      },
      esri_dark_labels: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'bg-layer',
        type: 'background',
        paint: { 'background-color': '#0B1120' },
      },
      {
        id: 'esri-dark-base-tiles',
        type: 'raster',
        source: 'esri_dark_base',
        minzoom: 0,
        maxzoom: 19,
      },
      {
        id: 'esri-dark-labels-tiles',
        type: 'raster',
        source: 'esri_dark_labels',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
};

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
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    const selectedStyle = STYLES[styleMode] || STYLES.dark;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: selectedStyle,
      center: [center.longitude, center.latitude],
      zoom,
      minZoom: 2,
      maxZoom: 18.5,
      interactive,
      attributionControl: false,
    });

    map.on('movestart', () => {
      isUserInteractingRef.current = true;
    });

    map.on('moveend', () => {
      isUserInteractingRef.current = false;
    });

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    }

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
    if (!map || isUserInteractingRef.current) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const dist = Math.hypot(currentCenter.lng - center.longitude, currentCenter.lat - center.latitude);
    const zoomDiff = Math.abs(currentZoom - zoom);

    if (dist > 0.002 || zoomDiff > 1.0) {
      map.flyTo({
        center: [center.longitude, center.latitude],
        zoom: Math.min(zoom, 18.5),
        duration: 500,
      });
    }
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
            'line-color': '#020617',
            'line-width': 8,
            'line-opacity': 0.7,
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
            'line-color': route.color || '#00D084',
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
        backgroundColor: marker.color || (isVehicle ? '#0F172A' : '#2563EB'),
        width: isVehicle ? '36px' : '22px',
        height: isVehicle ? '36px' : '22px',
        borderRadius: isVehicle ? '18px' : '11px',
        border: '2px solid #FFFFFF',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        color: '#FFFFFF',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.3s ease',
      });

      if (isVehicle) {
        element.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D084" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;
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
