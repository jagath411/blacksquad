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
  heading?: number;
  isVehicle?: boolean;
}

export interface RoutePolyline {
  coordinates: Array<[number, number]>; // [longitude, latitude]
  color?: string;
}

export interface MapViewProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  styleMode?: 'light' | 'dark' | 'voyager';
  markers?: MapMarker[];
  route?: RoutePolyline;
  interactive?: boolean;
  style?: any;
}

const STYLES: Record<string, any> = {
  light: {
    version: 8,
    sources: {
      carto_voyager: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap CARTO',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#F1F5F9' } },
      { id: 'carto-voyager', type: 'raster', source: 'carto_voyager', minzoom: 0, maxzoom: 19 },
    ],
  },
  dark: {
    version: 8,
    sources: {
      carto_dark: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap CARTO',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#07100D' } },
      { id: 'carto-dark', type: 'raster', source: 'carto_dark', minzoom: 0, maxzoom: 19 },
    ],
  },
  voyager: {
    version: 8,
    sources: {
      carto_voyager: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap CARTO',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#F1F5F9' } },
      { id: 'carto-voyager', type: 'raster', source: 'carto_voyager', minzoom: 0, maxzoom: 19 },
    ],
  },
};

export function MapView({
  center = { latitude: 12.9716, longitude: 77.5946 },
  zoom = 13,
  styleMode = 'light',
  markers = [],
  route,
  interactive = true,
  style,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[styleMode] || STYLES.light,
      center: [center.longitude, center.latitude],
      zoom,
      interactive,
      attributionControl: false,
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
    mapRef.current?.flyTo({
      center: [center.longitude, center.latitude],
      zoom,
      duration: 600,
    });
  }, [center.latitude, center.longitude, zoom]);

  // Route Polyline Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || Platform.OS !== 'web') return;

    const sourceId = 'route-source';
    const layerId = 'route-layer';

    const updateRoute = () => {
      if (!map.isStyleLoaded()) return;

      if (map.getLayer(layerId)) map.removeLayer(layerId);
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

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': route.color || '#2563EB',
            'line-width': 5,
            'line-opacity': 0.85,
          },
        });
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
        width: isVehicle ? '38px' : '32px',
        height: isVehicle ? '38px' : '32px',
        borderRadius: isVehicle ? '19px' : '16px',
        border: '2px solid #FFFFFF',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: isVehicle ? '18px' : '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.3s ease',
      });

      element.innerText = marker.badgeText || (isVehicle ? '🚗' : '•');

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
