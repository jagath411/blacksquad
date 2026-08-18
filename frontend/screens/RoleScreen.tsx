import React from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { colors } from '../constants/theme';
import type { RootStackParamList, UserRole } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Role'>;

export function RoleScreen({ navigation }: Props) {
  const select = (role: UserRole) => navigation.navigate('Login', { role });

  return (
    <Screen>
      <View style={s.header}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        <Text style={s.kicker}>TRANSPORT OPERATIONS</Text>
        <Text style={s.title}>Select Workspace</Text>
        <Text style={s.body}>
          Choose your account workspace. Riders request trips; Owners manage transport fleets; Drivers share live telemetry.
        </Text>
      </View>

      <View style={s.cards}>
        <AppButton label="🚗 I am a Customer / Rider" onPress={() => select('CUSTOMER')} />
        <AppButton label="🛞 I am a Driver" variant="secondary" onPress={() => select('DRIVER')} />
        <AppButton label="🏢 I am a Transport Fleet Owner" variant="secondary" onPress={() => select('OWNER')} />
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
}>({
  header: {
    flex: 1,
    justifyContent: 'center',
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginBottom: 16,
  },
  kicker: {
    color: colors.green,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    marginTop: 10,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 14,
  },
  cards: {
    gap: 12,
    paddingBottom: 16,
  },
});
