import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';
import { colors } from '../constants/theme';
import { ApiError } from '../services/api/client';
import { getHealth } from '../services/api/health';
import { googleLogin, login, register } from '../services/authService';
import type { RootStackParamList } from '../types';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '892541607147-lsvgfd2bnc14bedn150a0jflmv30gh1m.apps.googleusercontent.com';
const ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  '892541607147-no1cnphat1e4ksb72urft5l2991afn6l.apps.googleusercontent.com';
const IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '892541607147-mrse0ua8umjjk9rdc588chb3qtauph41.apps.googleusercontent.com';

export function LoginScreen({ navigation, route }: Props) {
  const [createMode, setCreateMode] = useState(false);
  const [api, setApi] = useState('Connecting to server...');
  const [apiOnline, setApiOnline] = useState(false);
  const [checkingApi, setCheckingApi] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    clientId: WEB_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: 'id_token',
  });

  const checkBackendHealth = async () => {
    setCheckingApi(true);
    setApi('Checking server...');
    try {
      await getHealth();
      setApi('Server Online (65.2.202.84:5000)');
      setApiOnline(true);
      setError('');
    } catch {
      setApi('Server offline / Reconnecting');
      setApiOnline(false);
    } finally {
      setCheckingApi(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const timer = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        const errorMsg =
          googleResponse.error?.message ||
          googleResponse.params?.error_description ||
          'Google authentication was cancelled or blocked.';
        setError(`Google Sign-in: ${errorMsg}`);
      }
      setGoogleLoading(false);
      return;
    }

    const idToken =
      googleResponse.params?.id_token ||
      (googleResponse.authentication as any)?.idToken ||
      googleResponse.authentication?.accessToken;

    if (!idToken) {
      setError('Unable to retrieve identity credentials from Google.');
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(true);
    setError('');

    googleLogin(idToken, route.params.role)
      .then(() => {
        navigation.navigate('Home', { role: route.params.role });
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Google authentication failed. Please check network connection.'
        );
      })
      .finally(() => setGoogleLoading(false));
  }, [googleResponse, navigation, route.params.role]);

  const validEmail = email.includes('@') && email.includes('.');
  const validForm = validEmail && password.length >= 8 && (!createMode || name.trim().length >= 2);

  const submit = async () => {
    if (!validForm) {
      setError(
        createMode
          ? 'Enter your name, a valid email, and an 8-character password.'
          : 'Enter a valid email and an 8-character password.'
      );
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (createMode) await register(name.trim(), email.trim(), password, route.params.role);
      else await login(email.trim(), password);
      navigation.navigate('Home', { role: route.params.role });
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : 0;
      const message = cause instanceof Error ? cause.message.toLowerCase() : '';
      setError(
        status === 401 || message.includes('invalid email')
          ? 'Incorrect email or password. Create an account first if you are new.'
          : status === 409 || message.includes('already registered')
          ? 'This email is already registered. Switch to Sign in.'
          : status === 400
          ? 'Please check the highlighted details and try again.'
          : cause instanceof Error
          ? cause.message
          : 'Unable to complete request. Please verify server connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = () => {
    setError('');
    setGoogleLoading(true);
    promptGoogle()
      .then((res) => {
        if (res.type === 'cancel' || res.type === 'dismiss') {
          setGoogleLoading(false);
        }
      })
      .catch((err) => {
        setGoogleLoading(false);
        setError(`Unable to launch Google sign-in: ${err?.message || 'Authentication blocked'}`);
      });
  };

  return (
    <Screen>
      <View style={s.header}>
        {/* Modern Truck Location Branding Logo */}
        <Image
          source={require('../assets/logo.png')}
          style={s.logoImage}
          resizeMode="cover"
        />
        <View style={s.roleBadge}>
          <Text style={s.kicker}>{route.params.role} WORKSPACE</Text>
        </View>
        <Text style={s.title}>{createMode ? 'Create Account' : 'Welcome Back'}</Text>

        {/* Real-time Server Ping Pill with Tap to Retry */}
        <Pressable style={s.statusRow} onPress={checkBackendHealth}>
          <View
            style={[
              s.statusDot,
              { backgroundColor: apiOnline ? '#00D084' : '#EF4444' },
            ]}
          />
          <Text style={[s.status, { color: apiOnline ? '#00D084' : '#FCA5A5' }]}>
            {api}
          </Text>
          {checkingApi && <ActivityIndicator size="small" color="#00D084" style={{ marginLeft: 4 }} />}
        </Pressable>
      </View>

      <View style={s.form}>
        <Pressable
          accessibilityRole="button"
          disabled={loading || googleLoading}
          onPress={handleGooglePress}
          style={({ pressed }) => [
            s.googleBtn,
            pressed && s.googleBtnPressed,
            (loading || googleLoading) && s.btnDisabled,
          ]}
        >
          <Icon name="logo-google" size={18} color="#FFFFFF" />
          <Text style={s.googleBtnText}>
            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.divider}>OR WITH EMAIL</Text>
          <View style={s.dividerLine} />
        </View>

        {createMode && (
          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            tone="dark"
          />
        )}
        <Input
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          tone="dark"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete={createMode ? 'new-password' : 'current-password'}
          tone="dark"
        />

        <AppButton
          label={createMode ? 'Create account' : 'Sign in to workspace'}
          loading={loading}
          disabled={loading || googleLoading}
          onPress={submit}
        />

        {error ? (
          <View accessible accessibilityRole="alert" style={s.errorBox}>
            <Icon name="alert-circle" size={18} color="#F87171" />
            <View style={s.errorContent}>
              <Text style={s.errorTitle}>Authentication Notice</Text>
              <Text style={s.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setCreateMode((value) => !value);
            setError('');
          }}
          style={s.switchPressable}
        >
          <Text style={s.switch}>
            {createMode ? 'Already registered? Sign in' : 'Need an account? Create one now'}
          </Text>
        </Pressable>

        <Text style={s.note}>End-to-end encrypted transport operations security.</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create<{
  header: ViewStyle;
  logoImage: ImageStyle;
  roleBadge: ViewStyle;
  kicker: TextStyle;
  title: TextStyle;
  statusRow: ViewStyle;
  statusDot: ViewStyle;
  status: TextStyle;
  form: ViewStyle;
  googleBtn: ViewStyle;
  googleBtnPressed: ViewStyle;
  btnDisabled: ViewStyle;
  googleBtnText: TextStyle;
  dividerRow: ViewStyle;
  dividerLine: ViewStyle;
  divider: TextStyle;
  errorBox: ViewStyle;
  errorContent: ViewStyle;
  errorTitle: TextStyle;
  errorText: TextStyle;
  switchPressable: ViewStyle;
  switch: TextStyle;
  note: TextStyle;
}>({
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 208, 132, 0.3)',
  },
  roleBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kicker: {
    color: '#00D084',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  googleBtnPressed: {
    backgroundColor: '#334155',
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  divider: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    gap: 10,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: '#F87171',
    fontWeight: '800',
    fontSize: 12,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  switchPressable: {
    paddingVertical: 6,
  },
  switch: {
    color: '#00D084',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
  },
  note: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
});
