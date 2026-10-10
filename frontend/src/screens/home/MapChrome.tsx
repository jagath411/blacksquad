import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { s } from './homeStyles';

interface HeaderProps {
  label: string;
  icon?: string;
  iconColor?: string;
  onHistory?: () => void;
  onProfile: () => void;
  extra?: React.ReactNode;
}

/** Brand badge and the round buttons that sit over the top of the map. */
export function MapHeader({ label, icon = 'flash', iconColor = '#00D084', onHistory, onProfile, extra }: HeaderProps) {
  return (
    <View style={s.mapTopRow}>
      <View style={s.brandBadge}>
        <Icon name={icon} size={14} color={iconColor} />
        <Text style={s.brandBadgeText}>{label}</Text>
      </View>
      <View style={s.headerBtnGroup}>
        {extra}
        {onHistory && (
          <Pressable accessibilityRole="button" accessibilityLabel="Trip history" style={s.profileAvatarBtn} onPress={onHistory}>
            <Icon name="time" size={16} color="#FFFFFF" />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" style={s.profileAvatarBtn} onPress={onProfile}>
          <Icon name="person" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

export function RecenterButton({ isLocating, onPress }: { isLocating: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Center map on my location" style={s.recenterFab} onPress={onPress}>
      {isLocating ? <ActivityIndicator size="small" color="#00D084" /> : <Icon name="locate" size={20} color="#00D084" />}
    </Pressable>
  );
}

/** Small banner over the map with the trip's current stage and, when known, the route. */
export function TripPill({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.floatingEtaPill}>
      <Icon name="navigate" size={14} color="#00D084" />
      <View style={s.floatingEtaContent}>
        <Text style={s.floatingEtaText}>{title}</Text>
        {subtitle ? (
          <Text style={s.floatingEtaSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
