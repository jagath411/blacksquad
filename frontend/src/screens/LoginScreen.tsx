import '../utils/cryptoPolyfill';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { googleLogin, login, register, sendPhoneOtp, verifyPhoneOtp, type UserProfile } from '../services/authService';
import type { RootStackParamList } from '../types';
import { formatUnifiedError, type FormattedError } from '../utils/errorHandler';
import { fonts } from '../theme/fonts';

WebBrowser.maybeCompleteAuthSession();

const ROLE_TITLES: Record<string, string> = {
  CUSTOMER: 'Sign in to book a ride',
  DRIVER: 'Sign in to drive',
  OWNER: 'Sign in to your fleet',
};

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

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw;
}

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
  const [smsProvider, setSmsProvider] = useState('');
  const [isLiveGateway, setIsLiveGateway] = useState(false);
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
      setApi('Connected');
      setApiOnline(true);
      if (error?.title === 'Connection Unavailable' || error?.title === 'Server Temporarily Unavailable') {
        setError(null);
      }
    } catch {
      setApi("Can't reach BlackSquad. Tap to try again.");
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

  // The server decides the account's role. If it differs from the portal picked, say why.
  const enterApp = (user: UserProfile) => {
    if (user.role !== role) {
      const reason =
        role === 'DRIVER'
          ? 'This account is not registered as a driver yet. Ask your fleet owner to add your phone number.'
          : role === 'OWNER'
            ? 'This account is not a fleet owner account. Contact BlackSquad to set up a fleet.'
            : `This account is a ${user.role.toLowerCase()} account.`;
      const title = `Signed in as ${user.role.toLowerCase()}`;
      if (Platform.OS === 'web') window.alert(`${title}\n\n${reason}`);
      else Alert.alert(title, reason);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home', params: { role: user.role } }] });
  };

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

    googleLogin(idToken)
      .then(enterApp)
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
      const res = await sendPhoneOtp(formatted);
      setPhone(formatted);
      setPhoneStep('otp');
      setResendTimer(60);
      setSmsProvider(res.smsProvider || '');
      setIsLiveGateway(Boolean(res.isLiveGateway));
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
  const handleVerifyPhoneOtp = async (overrideOtp?: string) => {
    setError(null);
    const targetOtp = (overrideOtp || otp).trim();
    if (!targetOtp || targetOtp.length < 4) {
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
      enterApp(await verifyPhoneOtp(formatted, targetOtp));
    } catch (cause) {
      setError(formatUnifiedError(cause, 'login'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Quick Auto-Fill and Sign In
  const handleAutoFillAndVerify = (code: string) => {
    setOtp(code);
    void handleVerifyPhoneOtp(code);
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
        enterApp(await register(name.trim(), email.trim(), password));
      } else {
        enterApp(await login(email.trim(), password));
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
        <Text style={s.title}>
          {authMethod === 'phone'
            ? phoneStep === 'input'
              ? ROLE_TITLES[role]
              : 'Enter your code'
            : createMode
            ? 'Create your account'
            : ROLE_TITLES[role]}
        </Text>

        {!apiOnline && !checkingApi ? (
        <Pressable style={s.statusRow} onPress={checkBackendHealth}>
          <View
            style={[
              s.statusDot,
              { backgroundColor: apiOnline ? '#1F3FB8' : '#C8372D' },
            ]}
          />
          <Text style={[s.status, { color: apiOnline ? '#1E8E5A' : '#C8372D' }]}>
            {api}
          </Text>
        </Pressable>
        ) : null}
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
          <Icon name="call" size={15} color={authMethod === 'phone' ? '#1D232B' : '#5B6573'} />
          <Text style={[s.tabBtnText, authMethod === 'phone' && s.tabBtnTextActive]}>
            Phone
          </Text>
        </Pressable>

        <Pressable
          style={[s.tabBtn, authMethod === 'email' && s.tabBtnActive]}
          onPress={() => {
            setAuthMethod('email');
            setError(null);
          }}
        >
          <Icon name="mail" size={15} color={authMethod === 'email' ? '#1D232B' : '#5B6573'} />
          <Text style={[s.tabBtnText, authMethod === 'email' && s.tabBtnTextActive]}>
            Email
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
              <View style={s.phoneInputContainer}>
                <Text style={s.inputLabel}>Mobile number</Text>
                <View style={s.phoneRow}>
                  <View style={s.countryPill}>
                    <Text style={s.countryFlag}>🇮🇳</Text>
                    <Text style={s.countryCode}>+91</Text>
                  </View>
                  <TextInput
                    style={s.phoneTextInput}
                    value={phone.replace(/^\+91/, '')}
                    onChangeText={(t) => {
                      setPhone(t);
                      setError(null);
                    }}
                    placeholder="98765 43210"
                    placeholderTextColor="#7A8592"
                    keyboardType="phone-pad"
                    autoFocus
                  />
                </View>
              </View>

              <AppButton
                label={sendingOtp ? 'Sending code…' : 'Send code'}
                loading={sendingOtp}
                disabled={sendingOtp || !phone.trim()}
                onPress={handleSendPhoneOtp}
              />
            </>
          ) : (
            <>
              <View style={s.phoneSentBadge}>
                <Icon name="chatbubble" size={15} color="#1E8E5A" />
                <View style={{ flex: 1 }}>
                  <Text style={s.phoneSentLabel}>Code sent by SMS to</Text>
                  <Text style={s.phoneSentNumber}>{formatPhoneDisplay(phone)}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setPhoneStep('input');
                    setOtp('');
                    setError(null);
                  }}
                  style={s.editPhoneBtn}
                >
                  <Icon name="create-outline" size={13} color="#2457D6" />
                  <Text style={s.editPhoneText}>Change</Text>
                </Pressable>
              </View>

              {/* Live vs Simulator SMS Status Banner */}
              {isLiveGateway ? (
                <View style={s.liveGatewayBadge}>
                  <Icon name="checkmark-circle" size={15} color="#1E8E5A" />
                  <Text style={s.liveGatewayText}>
                    Check your messages for a 6-digit code.
                  </Text>
                </View>
              ) : devOtp ? (
                <View style={s.smsSimulatorCard}>
                  <View style={s.smsSimulatorHeader}>
                    <Icon name="chatbubble-ellipses" size={15} color="#2457D6" />
                    <Text style={s.smsSimulatorTitle}>Development code</Text>
                  </View>
                  <Text style={s.smsSimulatorBody}>
                    &ldquo;Your BlackSquad verification code is{' '}
                    <Text style={s.smsCodeHighlight}>{devOtp}</Text>. Valid for 10 min.&rdquo;
                  </Text>
                  <Pressable
                    style={({ pressed }) => [s.smsAutoFillBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handleAutoFillAndVerify(devOtp)}
                  >
                    <Icon name="flash" size={13} color="#FFFFFF" />
                    <Text style={s.smsAutoFillText}>Use code and sign in</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={s.otpInputWrap}>
                <Text style={s.inputLabel}>6-digit code</Text>
                <TextInput
                  style={s.otpLargeInput}
                  value={otp}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/\D/g, '').slice(0, 6);
                    setOtp(cleaned);
                    setError(null);
                    if (cleaned.length === 6) {
                      void handleVerifyPhoneOtp(cleaned);
                    }
                  }}
                  placeholder="• • • • • •"
                  placeholderTextColor="#7A8592"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <AppButton
                label={verifyingOtp ? 'Checking code…' : 'Sign in'}
                loading={verifyingOtp}
                disabled={verifyingOtp || otp.trim().length < 4}
                onPress={() => handleVerifyPhoneOtp()}
              />

              <View style={s.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={s.resendTimerText}>You can ask for a new code in {resendTimer}s</Text>
                ) : (
                  <Pressable onPress={handleSendPhoneOtp}>
                    <Text style={s.resendLinkText}>Send a new code</Text>
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
              <Icon name="logo-google" size={18} color="#1D232B" />
              <Text style={s.googleBtnText}>
                {googleLoading ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </Pressable>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.divider}>or use your email</Text>
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
                placeholder="Your name"
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
                <Text style={s.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            )}

            <AppButton
              label={createMode ? 'Create account' : 'Sign in'}
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
                {createMode ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </>
        )}

        {/* Error Notification Box */}
        {error ? (
          <View accessible accessibilityRole="alert" style={s.errorBox}>
            <Icon name="alert-circle" size={20} color="#C8372D" />
            <View style={s.errorContent}>
              <Text style={s.errorTitle}>{error.title}</Text>
              <Text style={s.errorText}>{error.message}</Text>
            </View>
            <Pressable onPress={() => setError(null)} hitSlop={8} style={{ padding: 4 }}>
              <Icon name="close" size={16} color="#5B6573" />
            </Pressable>
          </View>
        ) : null}

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
  phoneInputContainer: ViewStyle;
  inputLabel: TextStyle;
  phoneRow: ViewStyle;
  countryPill: ViewStyle;
  countryFlag: TextStyle;
  countryCode: TextStyle;
  phoneTextInput: TextStyle;
  phoneSentBadge: ViewStyle;
  phoneSentLabel: TextStyle;
  phoneSentNumber: TextStyle;
  editPhoneBtn: ViewStyle;
  editPhoneText: TextStyle;
  liveGatewayBadge: ViewStyle;
  liveGatewayText: TextStyle;
  smsSimulatorCard: ViewStyle;
  smsSimulatorHeader: ViewStyle;
  smsSimulatorTitle: TextStyle;
  simTag: ViewStyle;
  simTagText: TextStyle;
  smsSimulatorBody: TextStyle;
  smsCodeHighlight: TextStyle;
  smsAutoFillBtn: ViewStyle;
  smsAutoFillText: TextStyle;
  otpInputWrap: ViewStyle;
  otpLargeInput: TextStyle;
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
  header: { alignItems: 'flex-start', marginTop: 12, marginBottom: 20 },
  logoImage: { width: 44, height: 44, borderRadius: 11, marginBottom: 20 },
  roleBadge: {
    backgroundColor: 'rgba(31, 63, 184, 0.10)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(31, 63, 184, 0.22)',
  },
  kicker: {
    color: '#1E8E5A',
    fontSize: 10,
    fontFamily: fonts.w700,
    },
  title: { color: '#1D232B', fontSize: 30, lineHeight: 34, fontFamily: fonts.w700, letterSpacing: -0.5 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E9EDF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontSize: 11,
    fontFamily: fonts.w600,
  },
  tabContainer: { flexDirection: 'row', backgroundColor: '#E9EDF1', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#1D232B', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabBtnText: { color: '#5B6573', fontSize: 15, fontFamily: fonts.w600 },
  tabBtnTextActive: { color: '#1D232B' },
  form: {
    gap: 12,
  },
  phoneInputContainer: {
    gap: 6,
  },
  inputLabel: { fontSize: 14, fontFamily: fonts.w600, color: '#1D232B' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#9AA4B0' },
  countryFlag: {
    fontSize: 16, fontFamily: fonts.w400,
  },
  countryCode: {
    color: '#1D232B',
    fontSize: 14,
    fontFamily: fonts.w600,
  },
  phoneTextInput: { flex: 1, backgroundColor: '#FFFFFF', color: '#1D232B', fontSize: 18, fontFamily: fonts.w500, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#9AA4B0' },
  phoneSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(31, 63, 184, 0.07)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(31, 63, 184, 0.22)',
  },
  phoneSentLabel: {
    color: '#5B6573',
    fontSize: 10,
    fontFamily: fonts.w600,
    },
  phoneSentNumber: {
    color: '#1E8E5A',
    fontSize: 15,
    fontFamily: fonts.w700,
    letterSpacing: 0.5,
  },
  editPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(36, 87, 214, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editPhoneText: {
    color: '#2457D6',
    fontSize: 11,
    fontFamily: fonts.w600,
  },
  liveGatewayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(31, 63, 184, 0.09)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(31, 63, 184, 0.26)',
  },
  liveGatewayText: {
    color: '#1E8E5A',
    fontSize: 12,
    fontFamily: fonts.w600,
    flex: 1,
  },
  smsSimulatorCard: {
    backgroundColor: '#E9EDF1',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(36, 87, 214, 0.40)',
    gap: 8,
  },
  smsSimulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smsSimulatorTitle: {
    color: '#2457D6',
    fontSize: 10,
    fontFamily: fonts.w700,
    flex: 1,
  },
  simTag: {
    backgroundColor: 'rgba(36, 87, 214, 0.20)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  simTagText: {
    color: '#2457D6',
    fontSize: 9,
    fontFamily: fonts.w700,
  },
  smsSimulatorBody: {
    color: '#3A4350',
    fontSize: 13, fontFamily: fonts.w400,
    lineHeight: 18,
  },
  smsCodeHighlight: {
    color: '#2457D6',
    fontFamily: fonts.figuresBold,
    fontSize: 15,
    
  },
  smsAutoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1F3FB8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 2,
    cursor: 'pointer' as any,
  },
  smsAutoFillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.w700,
  },
  otpInputWrap: {
    gap: 6,
  },
  otpLargeInput: {
    backgroundColor: '#FFFFFF',
    color: '#1E8E5A',
    fontSize: 22,
    fontFamily: fonts.figuresBold,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(31, 63, 184, 0.33)',
    
  },
  resendRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resendTimerText: {
    color: '#7A8592',
    fontSize: 12, fontFamily: fonts.w400,
  },
  resendLinkText: {
    color: '#1E8E5A',
    fontSize: 13,
    fontFamily: fonts.w600,
    textDecorationLine: 'underline',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EDF1',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.12)',
  },
  googleBtnPressed: {
    backgroundColor: '#D5DBE2',
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    color: '#1D232B',
    fontSize: 14,
    fontFamily: fonts.w700,
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
    backgroundColor: 'rgba(29, 35, 43, 0.08)',
  },
  divider: {
    color: '#7A8592',
    fontSize: 10,
    fontFamily: fonts.w700,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8372D',
    backgroundColor: 'rgba(200, 55, 45, 0.12)',
    padding: 12,
    gap: 10,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: '#C8372D',
    fontFamily: fonts.w700,
    fontSize: 12,
  },
  errorText: {
    color: '#C8372D',
    fontSize: 12, fontFamily: fonts.w400,
    lineHeight: 16,
    marginTop: 2,
  },
  switchPressable: {
    paddingVertical: 6,
  },
  switch: {
    color: '#1E8E5A',
    textAlign: 'center',
    fontFamily: fonts.w700,
    fontSize: 13,
  },
  note: {
    color: '#7A8592',
    fontSize: 11, fontFamily: fonts.w400,
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
    color: '#1E8E5A',
    fontSize: 12,
    fontFamily: fonts.w600,
  },
});
