import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
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

export function LoginScreen({ navigation, route }: Props) {
  const [createMode, setCreateMode] = useState(false);
  const [api, setApi] = useState('Checking connectivity...');
  const [apiOnline, setApiOnline] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const isGoogleConfigured = Boolean(webClientId || androidClientId || iosClientId);

  const nativeClientId = Platform.OS === 'android' ? androidClientId : iosClientId;
  const nativeClientKey = nativeClientId.split('.apps.googleusercontent.com')[0];
  const redirectUri = makeRedirectUri({
    scheme: 'blacksquad',
    native: nativeClientKey ? `com.googleusercontent.apps.${nativeClientKey}:/oauthredirect` : 'blacksquad:/oauthredirect',
  });

  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    webClientId: webClientId || undefined,
    androidClientId: androidClientId || undefined,
    iosClientId: iosClientId || undefined,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    selectAccount: true,
  });

  useEffect(() => {
    getHealth()
      .then(() => {
        setApi('Connected to Server');
        setApiOnline(true);
      })
      .catch(() => {
        setApi('Offline / Reconnecting');
        setApiOnline(false);
      });
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'dismiss' || googleResponse.type === 'cancel') {
      setGoogleLoading(false);
      return;
    }
    if (googleResponse.type !== 'success') {
      setError('Google sign-in was not completed. Please try again.');
      setGoogleLoading(false);
      return;
    }

    const token =
      googleResponse.authentication?.idToken ||
      googleResponse.params?.id_token ||
      googleResponse.authentication?.accessToken ||
      googleResponse.params?.access_token;

    if (!token) {
      setError('Google did not return an authentication token. Please try again.');
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(true);
    setError('');

    googleLogin(token, route.params.role)
      .then(() => navigation.navigate('Home', { role: route.params.role }))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed.';
        setError(msg);
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
          : 'Unable to complete the request.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = () => {
    if (!isGoogleConfigured) {
      setError('Google Sign-in is not yet configured for this build.');
      return;
    }
    if (!googleRequest) {
      setError('Google authentication service is initializing. Please tap again.');
      return;
    }
    setError('');
    setGoogleLoading(true);
    promptGoogle().catch(() => {
      setGoogleLoading(false);
      setError('Unable to launch Google sign-in window.');
    });
  };

  return (
    <Screen>
      <View style={s.header}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        <View style={s.roleBadge}>
          <Text style={s.kicker}>{route.params.role} WORKSPACE</Text>
        </View>
        <Text style={s.title}>{createMode ? 'Create Account' : 'Welcome Back'}</Text>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: apiOnline ? '#00D084' : '#F59E0B' }]} />
          <Text style={s.status}>{api}</Text>
        </View>
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
              <Text style={s.errorTitle}>Authentication Error</Text>
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
    marginTop: 24,
    marginBottom: 28,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
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
    fontSize: 28,
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
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
