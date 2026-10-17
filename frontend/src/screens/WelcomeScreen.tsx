import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { getAccessToken, getRefreshToken, getSessionUser, saveSessionUser, clearAllStorage } from '../services/tokenStore';
import { ApiError } from '../services/api/client';
import { getCurrentUser } from '../services/authService';
import type { RootStackParamList } from '../types';
import { fonts } from '../theme/fonts';
import { ink, paper, text2 } from '../theme/palette';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const hydrateSession = async () => {
      try {
        const token = await getAccessToken();
        const cachedUser = await getSessionUser();

        if ((token || (await getRefreshToken())) && cachedUser && cachedUser.role) {
          try {
            // Confirm the session with the server (this also renews an expired access token).
            const liveUser = await getCurrentUser();
            if (isMounted && liveUser && liveUser.role) {
              await saveSessionUser(liveUser);
              navigation.replace('Home', { role: liveUser.role });
              return;
            }
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 0) {
              // Offline: keep the user signed in and let the app reconnect later.
              if (isMounted) navigation.replace('Home', { role: cachedUser.role });
              return;
            }
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
      <View style={s.splash}>
        <Image source={require('../assets/logo.png')} style={s.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="small" color={ink} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Screen>
      <View style={s.brand}>
        <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.brandName}>BlackSquad</Text>
      </View>

      <View style={s.center}>
        <Text style={s.title}>Get there.{'\n'}Know where{'\n'}everyone is.</Text>
        <Text style={s.body}>
          Book a ride with the price shown up front, drive and get paid for your trips, or run your whole fleet from one
          live map.
        </Text>
      </View>

      <View style={s.footer}>
        <AppButton label="Get started" onPress={() => navigation.navigate('Role')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create<{
  splash: ViewStyle;
  splashLogo: ImageStyle;
  brand: ViewStyle;
  logo: ImageStyle;
  brandName: TextStyle;
  center: ViewStyle;
  title: TextStyle;
  body: TextStyle;
  footer: ViewStyle;
}>({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: paper },
  splashLogo: { width: 72, height: 72, borderRadius: 18 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  brandName: { fontFamily: fonts.w700, fontSize: 20, color: ink, letterSpacing: -0.2 },
  center: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  title: { fontFamily: fonts.w700, fontSize: 46, lineHeight: 48, color: ink, letterSpacing: -1 },
  body: { fontFamily: fonts.w400, fontSize: 17, lineHeight: 26, color: text2, marginTop: 20, maxWidth: 360 },
  footer: { paddingBottom: 8 },
});
