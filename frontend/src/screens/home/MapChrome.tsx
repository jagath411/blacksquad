import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
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
export function MapHeader({ label, onHistory, onProfile, extra }: HeaderProps) {
  return (
    <View style={s.mapTopRow}>
      <View style={s.brandBadge}>
        <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22, borderRadius: 6 }} />
        <Text style={s.brandBadgeText}>{label}</Text>
      </View>
      <View style={s.headerBtnGroup}>
        {extra}
        {onHistory && (
          <Pressable accessibilityRole="button" accessibilityLabel="Trip history" style={s.profileAvatarBtn} onPress={onHistory}>
            <Icon name="time" size={16} color="#1D232B" />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" style={s.profileAvatarBtn} onPress={onProfile}>
          <Icon name="person" size={16} color="#1D232B" />
        </Pressable>
      </View>
    </View>
  );
}

export function RecenterButton({ isLocating, onPress }: { isLocating: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Center map on my location" style={s.recenterFab} onPress={onPress}>
      {isLocating ? <ActivityIndicator size="small" color="#1D232B" /> : <Icon name="locate" size={22} color="#1D232B" />}
    </Pressable>
  );
}

/** Small banner over the map with the trip's current stage and, when known, the route. */
export function TripPill({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.floatingEtaPill}>
      <Icon name="navigate" size={18} color="#FFC21A" />
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

/** A registration number or PIN drawn like an Indian number plate, so it can be matched at a glance. */
export function NumberPlate({ text, caption }: { text: string; caption?: string }) {
  return (
    <View style={s.otpBadge} accessible accessibilityLabel={caption ? `${caption} ${text}` : text}>
      {caption ? <Text style={s.otpLabel}>{caption}</Text> : null}
      <Text style={[s.otpCode, !caption && { fontSize: 22, lineHeight: 26, letterSpacing: 1.5 }]}>{text}</Text>
    </View>
  );
}
