import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Icon } from '../components/ui/Icon';
import { colors } from '../constants/theme';
import type { RootStackParamList, UserRole } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Role'>;

interface RoleOption {
  role: UserRole;
  icon: string;
  iconFamily: 'ionicons' | 'material' | 'feather';
  iconColor: string;
  badge: string;
  title: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'CUSTOMER',
    icon: 'car-sport',
    iconFamily: 'ionicons',
    iconColor: '#00D084',
    badge: 'RIDER',
    title: 'Customer / Rider',
    description: 'Book immediate or scheduled rides, view fare quotes, and live-track your driver on the map.',
  },
  {
    role: 'DRIVER',
    icon: 'steering',
    iconFamily: 'material',
    iconColor: '#38BDF8',
    badge: 'PARTNER',
    title: 'Driver Partner',
    description: 'Toggle duty online/offline, accept ride dispatches, navigate routes, and verify OTP boarding.',
  },
  {
    role: 'OWNER',
    icon: 'business',
    iconFamily: 'ionicons',
    iconColor: '#F59E0B',
    badge: 'OPERATIONS',
    title: 'Fleet Operations Owner',
    description: 'Live radar overview of all active fleet vehicles, driver duty stats, and transport management.',
  },
];

export function RoleScreen({ navigation }: Props) {
  const select = (role: UserRole) => navigation.navigate('Login', { role });

  return (
    <Screen>
      <View style={s.header}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        <Text style={s.kicker}>WORKSPACE ACCESS</Text>
        <Text style={s.title}>Select your portal</Text>
        <Text style={s.body}>
          Choose your account workspace to continue. You can switch or sign in with your role-specific credentials.
        </Text>
      </View>

      <View style={s.cards}>
        {ROLES.map((item) => (
          <Pressable
            key={item.role}
            accessibilityRole="button"
            onPress={() => select(item.role)}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          >
            <View style={[s.iconBox, { backgroundColor: `${item.iconColor}18` }]}>
              <Icon name={item.icon} family={item.iconFamily} size={24} color={item.iconColor} />
            </View>
            <View style={s.cardBody}>
              <View style={s.titleRow}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <View style={[s.badge, { backgroundColor: `${item.iconColor}22` }]}>
                  <Text style={[s.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
                </View>
              </View>
              <Text style={s.cardDesc}>{item.description}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color="#64748B" />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create<{
  header: ViewStyle;
  logoImage: ImageStyle;
  kicker: TextStyle;
  title: TextStyle;
  body: TextStyle;
  cards: ViewStyle;
  card: ViewStyle;
  cardPressed: ViewStyle;
  iconBox: ViewStyle;
  cardBody: ViewStyle;
  titleRow: ViewStyle;
  cardTitle: TextStyle;
  badge: ViewStyle;
  badgeText: TextStyle;
  cardDesc: TextStyle;
}>({
  header: {
    paddingTop: 12,
    marginBottom: 24,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: 12,
  },
  kicker: {
    color: colors.green,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 6,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  cards: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  cardPressed: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
});
