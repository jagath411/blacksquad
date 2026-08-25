import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
import { getHealth } from '../services/api/health';
import { googleLogin, login, register, sendPhoneOtp, verifyPhoneOtp } from '../services/authService';
import type { RootStackParamList } from '../types';
import { formatUnifiedError, type FormattedError } from '../utils/errorHandler';

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
  const role = route.params.role;
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [createMode, setCreateMode] = useState(false);
  const [api, setApi] = useState('Connecting to server...');
  const [apiOnline, setApiOnline] = useState(false);
  const [checkingApi, setCheckingApi] = useState(false);

  // Email form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone OTP form state
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const [error, setError] = useState<FormattedError | null>(null);
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
      if (error?.title === 'Connection Unavailable' || error?.title === 'Server Temporarily Unavailable') {
        setError(null);
      }
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

  // Countdown timer for OTP resend
  useEffect(() => {
    if (phoneStep !== 'otp' || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phoneStep, resendTimer]);

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        setError(formatUnifiedError(googleResponse.error || googleResponse.params?.error_description));
      }
      setGoogleLoading(false);
      return;
    }

    const idToken =
      googleResponse.params?.id_token ||
      (googleResponse.authentication as any)?.idToken ||
      googleResponse.authentication?.accessToken;

    if (!idToken) {
      setError({
        title: 'Identity Verification Failed',
        message: 'Google did not return credentials. Please try signing in with email or phone.',
      });
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(true);
    setError(null);

    googleLogin(idToken, role)
      .then((user) => {
        navigation.navigate('Home', { role: user.role || role });
      })
      .catch((err) => {
        setError(formatUnifiedError(err, 'login'));
      })
      .finally(() => setGoogleLoading(false));
  }, [googleResponse, navigation, role]);

  // Phone: Send OTP Handler
  const handleSendPhoneOtp = async () => {
    setError(null);
    const cleaned = phone.trim().replace(/[\s-]/g, '');
    if (!cleaned || cleaned.length < 8) {
      setError({
        title: 'Invalid Phone Number',
        message: 'Please enter a valid 10-digit mobile number.',
      });
      return;
    }

    const formatted = cleaned.startsWith('+') ? cleaned : `+91${cleaned.replace(/^0+/, '')}`;
    setSendingOtp(true);
    try {
      const res = await sendPhoneOtp(formatted, role);
      setPhoneStep('otp');
      setResendTimer(30);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
    } catch (cause) {
      setError(formatUnifiedError(cause, 'login'));
    } finally {
      setSendingOtp(false);
    }
  };

  // Phone: Verify OTP Handler
  const handleVerifyPhoneOtp = async () => {
    setError(null);
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setError({
        title: 'Enter Verification Code',
        message: 'Please enter the 6-digit OTP code received via SMS.',
      });
      return;
    }

    const cleaned = phone.trim().replace(/[\s-]/g, '');
    const formatted = cleaned.startsWith('+') ? cleaned : `+91${cleaned.replace(/^0+/, '')}`;

    setVerifyingOtp(true);
    try {
      const user = await verifyPhoneOtp(formatted, trimmedOtp, role);
      navigation.navigate('Home', { role: user.role || role });
    } catch (cause) {
      setError(formatUnifiedError(cause, 'login'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Email form submit
  const validEmail = email.includes('@') && email.includes('.');
  const validForm = validEmail && password.length >= 8 && (!createMode || name.trim().length >= 2);

  const submitEmail = async () => {
    if (!validForm) {
      setError({
        title: 'Missing Required Fields',
        message: createMode
          ? 'Enter your full name, a valid email, and an 8-character password.'
          : 'Enter your email address and an 8-character password.',
      });
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (createMode) {
        const user = await register(name.trim(), email.trim(), password, role);
        navigation.navigate('Home', { role: user.role || role });
      } else {
        const user = await login(email.trim(), password);
        navigation.navigate('Home', { role: user.role || role });
      }
    } catch (cause) {
      setError(formatUnifiedError(cause, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = () => {
    setError(null);
    if (!googleRequest) {
      setError({
        title: 'Google Sign-in Preparing',
        message: 'Google authentication window is initializing. Please tap again in a moment.',
      });
      return;
    }
    setGoogleLoading(true);
    promptGoogle()
      .then((res) => {
        if (res.type === 'cancel' || res.type === 'dismiss') {
          setGoogleLoading(false);
        }
      })
      .catch((err) => {
        setGoogleLoading(false);
        setError(formatUnifiedError(err));
      });
  };

  return (
    <Screen>
      <View style={s.header}>
        <Image
          source={require('../assets/logo.png')}
          style={s.logoImage}
          resizeMode="cover"
        />
        <View style={s.roleBadge}>
          <Text style={s.kicker}>{role} WORKSPACE</Text>
        </View>
        <Text style={s.title}>
          {authMethod === 'phone'
            ? phoneStep === 'input'
              ? 'Sign in with Mobile'
              : 'Verify Phone OTP'
            : createMode
            ? 'Create Account'
            : 'Welcome Back'}
        </Text>

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

      {/* Auth Method Tabs */}
      <View style={s.tabContainer}>
        <Pressable
          style={[s.tabBtn, authMethod === 'phone' && s.tabBtnActive]}
          onPress={() => {
            setAuthMethod('phone');
            setError(null);
          }}
        >
          <Icon name="call" size={14} color={authMethod === 'phone' ? '#00D084' : '#64748B'} />
          <Text style={[s.tabBtnText, authMethod === 'phone' && s.tabBtnTextActive]}>
            Phone OTP
          </Text>
        </Pressable>

        <Pressable
          style={[s.tabBtn, authMethod === 'email' && s.tabBtnActive]}
          onPress={() => {
            setAuthMethod('email');
            setError(null);
          }}
        >
          <Icon name="mail" size={14} color={authMethod === 'email' ? '#00D084' : '#64748B'} />
          <Text style={[s.tabBtnText, authMethod === 'email' && s.tabBtnTextActive]}>
            Email / Password
          </Text>
        </Pressable>
      </View>

      <View style={s.form}>
        {/* ========================================================================= */}
        {/* 1. PHONE NUMBER OTP AUTHENTICATION FLOW */}
        {/* ========================================================================= */}
        {authMethod === 'phone' ? (
          phoneStep === 'input' ? (
            <>
              <Input
                label="Mobile Phone Number"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setError(null);
                }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                autoCapitalize="none"
                tone="dark"
              />

              <AppButton
                label={sendingOtp ? 'Sending OTP...' : 'Send OTP Code →'}
                loading={sendingOtp}
                disabled={sendingOtp || !phone.trim()}
                onPress={handleSendPhoneOtp}
              />
            </>
          ) : (
            <>
              <View style={s.phoneSentBadge}>
                <Icon name="chatbubble" size={14} color="#00D084" />
                <Text style={s.phoneSentText}>
                  Code sent to <Text style={{ color: '#00D084', fontWeight: '800' }}>{phone}</Text>
                </Text>
                <Pressable
                  onPress={() => {
                    setPhoneStep('input');
                    setOtp('');
                    setError(null);
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  <Text style={s.editPhoneText}>Edit</Text>
                </Pressable>
              </View>

              <Input
                label="6-Digit Verification Code"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t);
                  setError(null);
                }}
                placeholder="• • • • • •"
                keyboardType="number-pad"
                autoCapitalize="none"
                tone="dark"
              />

              {!!devOtp && (
                <Pressable
                  style={s.devOtpBox}
                  onPress={() => setOtp(devOtp)}
                >
                  <Text style={s.devOtpLabel}>🔧 Dev Auto-Fill OTP:</Text>
                  <Text style={s.devOtpCode}>{devOtp}</Text>
                </Pressable>
              )}

              <AppButton
                label={verifyingOtp ? 'Verifying OTP...' : 'Verify & Sign In'}
                loading={verifyingOtp}
                disabled={verifyingOtp || !otp.trim()}
                onPress={handleVerifyPhoneOtp}
              />

              <View style={s.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={s.resendTimerText}>Resend code in {resendTimer}s</Text>
                ) : (
                  <Pressable onPress={handleSendPhoneOtp}>
                    <Text style={s.resendLinkText}>Resend OTP SMS</Text>
                  </Pressable>
                )}
              </View>
            </>
          )
        ) : (
          /* ========================================================================= */
          /* 2. EMAIL & PASSWORD AUTHENTICATION FLOW */
          /* ========================================================================= */
          <>
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
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="John Doe"
                autoCapitalize="words"
                tone="dark"
              />
            )}
            <Input
              label="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              tone="dark"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete={createMode ? 'new-password' : 'current-password'}
              tone="dark"
            />

            {!createMode && (
              <Pressable
                style={s.forgotPasswordBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={s.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>
            )}

            <AppButton
              label={createMode ? 'Create account' : 'Sign in to workspace'}
              loading={loading}
              disabled={loading || googleLoading}
              onPress={submitEmail}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCreateMode((value) => !value);
                setError(null);
              }}
              style={s.switchPressable}
            >
              <Text style={s.switch}>
                {createMode ? 'Already registered? Sign in' : 'Need an account? Create one now'}
              </Text>
            </Pressable>
          </>
        )}

        {/* Error Notification Box */}
        {error ? (
          <View accessible accessibilityRole="alert" style={s.errorBox}>
            <Icon name="alert-circle" size={20} color="#F87171" />
            <View style={s.errorContent}>
              <Text style={s.errorTitle}>{error.title}</Text>
              <Text style={s.errorText}>{error.message}</Text>
            </View>
            <Pressable onPress={() => setError(null)} hitSlop={8} style={{ padding: 4 }}>
              <Icon name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>
        ) : null}

        <Text style={s.note}>End-to-end encrypted BlackSquad transport operations security.</Text>
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
  tabContainer: ViewStyle;
  tabBtn: ViewStyle;
  tabBtnActive: ViewStyle;
  tabBtnText: TextStyle;
  tabBtnTextActive: TextStyle;
  form: ViewStyle;
  phoneSentBadge: ViewStyle;
  phoneSentText: TextStyle;
  editPhoneText: TextStyle;
  devOtpBox: ViewStyle;
  devOtpLabel: TextStyle;
  devOtpCode: TextStyle;
  resendRow: ViewStyle;
  resendTimerText: TextStyle;
  resendLinkText: TextStyle;
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
  forgotPasswordBtn: ViewStyle;
  forgotPasswordText: TextStyle;
}>({
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.25)',
  },
  kicker: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.3)',
  },
  tabBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#00D084',
  },
  form: {
    gap: 12,
  },
  phoneSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 132, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.25)',
  },
  phoneSentText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  editPhoneText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  devOtpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  devOtpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FACC15',
  },
  devOtpCode: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FEF08A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  resendRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resendTimerText: {
    color: '#64748B',
    fontSize: 12,
  },
  resendLinkText: {
    color: '#00D084',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: -4,
    marginBottom: 2,
  },
  forgotPasswordText: {
    color: '#00D084',
    fontSize: 12,
    fontWeight: '600',
  },
});
