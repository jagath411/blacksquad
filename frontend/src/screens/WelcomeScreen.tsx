import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { Icon } from '../components/ui/Icon';
import { colors } from '../constants/theme';
import { getAccessToken, getSessionUser, saveSessionUser, clearAllStorage } from '../services/tokenStore';
import { getCurrentUser } from '../services/authService';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const hydrateSession = async () => {
      try {
        const token = await getAccessToken();
        const cachedUser = await getSessionUser();

        if (token && cachedUser && cachedUser.role) {
          try {
            // Validate token against backend to prevent stale session exploits
            const liveUser = await getCurrentUser();
            if (isMounted && liveUser && liveUser.role) {
              await saveSessionUser(liveUser);
              navigation.replace('Home', { role: liveUser.role });
              return;
            }
          } catch {
            // Token expired or revoked — clear storage cleanly
            await clearAllStorage();
          }
        }
      } catch (err) {
        // Fallback to welcome screen
      } finally {
        if (isMounted) setIsHydrating(false);
      }
    };

    void hydrateSession();
    return () => {
      isMounted = false;
    };
  }, [navigation]);

  if (isHydrating) {
    return (
      <View style={s.splashContainer}>
        <Image source={require('../assets/logo.png')} style={s.splashLogo} resizeMode="contain" />
        <Text style={s.splashTitle}>BLACKSQUAD</Text>
        <Text style={s.splashSub}>MOBILITY OS</Text>
        <ActivityIndicator size="small" color="#00D084" style={{ marginTop: 24 }} />
      </View>
    );
  }

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
  splashContainer: ViewStyle;
  splashLogo: ImageStyle;
  splashTitle: TextStyle;
  splashSub: TextStyle;
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
  splashContainer: {
    flex: 1,
    backgroundColor: '#07100D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  splashLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
  },
  splashTitle: {
    fontSize: 22,
    letterSpacing: 3,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  splashSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00D084',
    letterSpacing: 2,
    marginTop: 4,
  },
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
