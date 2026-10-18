import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../theme/fonts';
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
      <Icon name="navigate" size={18} color="#9DB2FF" />
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

const TRIP_STEPS = [
  { status: 'DRIVER_ACCEPTED', label: 'Assigned' },
  { status: 'DRIVER_ARRIVING', label: 'At pickup' },
  { status: 'TRIP_STARTED', label: 'On the way' },
  { status: 'TRIP_COMPLETED', label: 'Arrived' },
] as const;

/** Four-step trip tracker; the current step pulses gently so the eye finds it. */
export function TripSteps({ status }: { status: string }) {
  const current = TRIP_STEPS.findIndex((step) => step.status === status);
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
          ]),
        );
        loop.start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse, status]);

  const label = current >= 0 ? `Step ${current + 1} of 4: ${TRIP_STEPS[current]!.label}` : 'Finding a driver';
  return (
    <View style={stepStyles.wrap} accessible accessibilityLabel={label}>
      {TRIP_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const reached = done || active;
        return (
          <View key={step.status} style={stepStyles.column}>
            <View style={stepStyles.row}>
              <View style={[stepStyles.line, index === 0 && stepStyles.hidden, reached && stepStyles.lineDone]} />
              <View style={stepStyles.dotSlot}>
                {active ? <Animated.View style={[stepStyles.halo, { transform: [{ scale: pulse }] }]} /> : null}
                <View style={[stepStyles.dot, done && stepStyles.dotDone, active && stepStyles.dotActive]} />
              </View>
              <View
                style={[stepStyles.line, index === TRIP_STEPS.length - 1 && stepStyles.hidden, done && stepStyles.lineDone]}
              />
            </View>
            <Text style={[stepStyles.label, active && stepStyles.labelActive]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** A bar that empties as an offer's time runs out. */
export function CountdownBar({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const [width] = useState(() => new Animated.Value(secondsLeft / totalSeconds));
  useEffect(() => {
    Animated.timing(width, { toValue: secondsLeft / totalSeconds, duration: 950, useNativeDriver: false }).start();
  }, [secondsLeft, totalSeconds, width]);
  const urgent = secondsLeft <= 5;
  return (
    <View style={stepStyles.countdownTrack} accessible accessibilityLabel={`${secondsLeft} seconds left to accept`}>
      <Animated.View
        style={[
          stepStyles.countdownFill,
          urgent && { backgroundColor: '#C8372D' },
          { width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: 16 },
  column: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  hidden: { opacity: 0 },
  line: { flex: 1, height: 3, backgroundColor: '#D5DBE2' },
  lineDone: { backgroundColor: '#1F3FB8' },
  dotSlot: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(31, 63, 184, 0.22)' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D5DBE2' },
  dotDone: { backgroundColor: '#1F3FB8', borderColor: '#1F3FB8' },
  dotActive: { backgroundColor: '#1F3FB8', borderColor: '#FFFFFF', width: 14, height: 14, borderRadius: 7 },
  label: { textAlign: 'center', color: '#7A8592', fontSize: 13, fontFamily: fonts.w500, marginTop: 8 },
  labelActive: { color: '#1D232B', fontFamily: fonts.w700 },
  countdownTrack: { height: 6, borderRadius: 3, backgroundColor: '#E9EDF1', overflow: 'hidden', marginTop: 12, marginBottom: 4 },
  countdownFill: { height: 6, borderRadius: 3, backgroundColor: '#1F3FB8' },
});
