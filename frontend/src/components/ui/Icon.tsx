import React from 'react';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

export type IconFamily = 'ionicons' | 'material' | 'feather';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  family?: IconFamily;
  style?: StyleProp<TextStyle>;
}

export function Icon({
  name,
  size = 20,
  color = '#FFFFFF',
  family = 'ionicons',
  style,
}: IconProps) {
  if (family === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
  }
  if (family === 'feather') {
    return <Feather name={name as any} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}
