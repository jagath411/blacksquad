import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as maplibregl from 'maplibre-gl';

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

// 100% Free, keyless, open tile specifications for MapLibre
const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-light-layer',
      type: 'raster',
      source: 'carto-light',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const VOYAGER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const STYLES = {
  light: LIGHT_STYLE,
  dark: DARK_STYLE,
  voyager: VOYAGER_STYLE,
};

export function MapView({
  center = { latitude: 12.9716, longitude: 77.5946 },
  zoom = 12,
  styleMode = 'light',
  markers = [],
  interactive = true,
  style,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Initialize MapLibre GL JS on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    // Inject MapLibre CSS stylesheet if not present
    if (typeof document !== 'undefined' && !document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    const selectedStyle = STYLES[styleMode] || STYLES.light;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: selectedStyle,
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

  // Update map center when props change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.longitude, center.latitude],
      zoom,
      duration: 1000,
    });
  }, [center.latitude, center.longitude, zoom]);

  // Update markers on map
  useEffect(() => {
    if (!mapRef.current) return;
    const currentMap = mapRef.current;
    const existing = markerInstancesRef.current;
    const nextIds = new Set(markers.map((m) => m.id));

    // Remove old markers
    existing.forEach((markerInstance, id) => {
      if (!nextIds.has(id)) {
        markerInstance.remove();
        existing.delete(id);
      }
    });

    // Add or update markers
    markers.forEach((m) => {
      let instance = existing.get(m.id);
      if (instance) {
        instance.setLngLat([m.longitude, m.latitude]);
      } else {
        const el = document.createElement('div');
        el.style.backgroundColor = m.color || '#2563EB';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '15px';
        el.style.border = '2px solid #FFFFFF';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.color = '#FFFFFF';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '12px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        if (m.badgeText) {
          el.innerText = m.badgeText;
        }

        const newMarker = new maplibregl.Marker({ element: el })
          .setLngLat([m.longitude, m.latitude]);

        if (m.title) {
          newMarker.setPopup(new maplibregl.Popup({ offset: 20 }).setText(m.title));
        }

        newMarker.addTo(currentMap);
        existing.set(m.id, newMarker);
      }
    });
  }, [markers]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.fallbackContainer, style]}>
      <Text style={styles.fallbackText}>MapLibre Mobile View</Text>
      <Text style={styles.fallbackSubtext}>Latitude: {center.latitude.toFixed(4)}, Longitude: {center.longitude.toFixed(4)}</Text>
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
  fallbackContainer: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fallbackSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
});
