import React from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { Icon } from '../components/ui/Icon';
import { colors } from '../constants/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={s.brand}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        <View style={s.brandTextGroup}>
          <Text style={s.brandName}>BLACKSQUAD</Text>
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>MOBILITY OS</Text>
          </View>
        </View>
      </View>

      <View style={s.center}>
        <Text style={s.title}>
          Every ride,{'\n'}
          <Text style={s.dim}>under control.</Text>
        </Text>
        <Text style={s.body}>
          Book trusted transport, track live driver fleets on the map, and manage trips effortlessly from one secure mobile app.
        </Text>

        <View style={s.featureGrid}>
          <View style={s.featureItem}>
            <View style={s.featureIconBox}>
              <Icon name="navigate" size={18} color="#00D084" />
            </View>
            <View style={s.featureContent}>
              <Text style={s.featureTitle}>Real-Time GPS Tracking</Text>
              <Text style={s.featureSub}>Sub-second vehicle telemetry & route preview</Text>
            </View>
          </View>

          <View style={s.featureItem}>
            <View style={s.featureIconBox}>
              <Icon name="shield-checkmark" size={18} color="#38BDF8" />
            </View>
            <View style={s.featureContent}>
              <Text style={s.featureTitle}>Verified OTP Boarding</Text>
              <Text style={s.featureSub}>4-digit PIN verification before trip start</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.footer}>
        <AppButton label="Get Started" onPress={() => navigation.navigate('Role')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create<{
  brand: ViewStyle;
  logoImage: ImageStyle;
  brandTextGroup: ViewStyle;
  brandName: TextStyle;
  livePill: ViewStyle;
  liveDot: ViewStyle;
  liveText: TextStyle;
  center: ViewStyle;
  title: TextStyle;
  dim: TextStyle;
  body: TextStyle;
  featureGrid: ViewStyle;
  featureItem: ViewStyle;
  featureIconBox: ViewStyle;
  featureContent: ViewStyle;
  featureTitle: TextStyle;
  featureSub: TextStyle;
  footer: ViewStyle;
}>({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  brandTextGroup: {
    gap: 2,
  },
  brandName: {
    fontSize: 16,
    letterSpacing: 2,
    color: '#F8FAFC',
    fontWeight: '900',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D084',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00D084',
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 36,
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: colors.text,
    fontWeight: '900',
  },
  dim: {
    color: '#64748B',
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: '#94A3B8',
    marginTop: 14,
    maxWidth: 420,
  },
  featureGrid: {
    marginTop: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  featureSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  footer: {
    paddingBottom: 16,
  },
});
