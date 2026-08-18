import React from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { colors } from '../constants/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={s.brand}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        <Text style={s.kicker}>BLACKSQUAD MOBILITY</Text>
      </View>

      <View style={s.center}>
        <Text style={s.title}>
          Every journey,{'\n'}
          <Text style={s.dim}>under control.</Text>
        </Text>
        <Text style={s.body}>
          Book trusted transport, track live driver fleets, or manage trips from the road—all from one secure mobile app.
        </Text>
      </View>

      <AppButton label="Get started" onPress={() => navigation.navigate('Role')} />
    </Screen>
  );
}

const s = StyleSheet.create<{
  brand: ViewStyle;
  logoImage: ImageStyle;
  kicker: TextStyle;
  center: ViewStyle;
  title: TextStyle;
  dim: TextStyle;
  body: TextStyle;
}>({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 2,
    color: colors.muted,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60,
  },
  title: {
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2,
    color: colors.text,
    fontWeight: '800',
  },
  dim: {
    color: '#71887B',
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.muted,
    marginTop: 22,
    maxWidth: 430,
  },
});
