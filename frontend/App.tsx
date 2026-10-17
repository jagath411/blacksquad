import './src/utils/cryptoPolyfill';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather, MaterialIcons } from '@expo/vector-icons';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { ink, brand, paper } from './src/theme/palette';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { RoleScreen } from './src/screens/RoleScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import type { RootStackParamList } from './src/types';
import { onSessionExpired } from './src/services/session';
import { disconnectFleetSocket } from './src/services/socket';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  // When a session can no longer be renewed, close the live connection and return to sign-in.
  useEffect(
    () =>
      onSessionExpired(() => {
        disconnectFleetSocket();
        if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Role' }] });
      }),
    [],
  );

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...Feather.font,
    ...MaterialIcons.font,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ink} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: paper, primary: brand, text: ink },
      }}
    >
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Role" component={RoleScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
