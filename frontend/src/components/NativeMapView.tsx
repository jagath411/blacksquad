import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { MapMarker, RoutePolyline } from './MapView';

interface Props {
  center: { latitude: number; longitude: number };
  zoom: number;
  markers: MapMarker[];
  route?: RoutePolyline;
  interactive: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NativeMapView(_props: Props) {
  return <View />;
}
