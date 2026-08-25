import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Input } from '../components/ui/Input';
import { AppButton } from '../components/AppButton';
import { Icon } from '../components/ui/Icon';
import { apiRequest } from '../services/api/client';
import type { RootStackParamList } from '../types';
import { formatUnifiedError } from '../utils/errorHandler';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [devToken, setDevToken] = useState('');

  const handleSendReset = async () => {
    setErrorMsg('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        devResetToken?: string;
      }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed }),
      });
      setSent(true);
      if (res.devResetToken) {
        setDevToken(res.devResetToken);
      }
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToReset = () => {
    navigation.navigate('ResetPassword', { email: email.trim().toLowerCase(), token: devToken });
  };

  return (
    <Screen tone="dark">
      {/* Header */}
      <Pressable style={s.back} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={20} color="#94A3B8" />
        <Text style={s.backText}>Back to Login</Text>
      </Pressable>

      <View style={s.iconWrap}>
        <Icon name="lock-closed" size={38} color="#00D084" />
      </View>
      <Text style={s.title}>Forgot Password?</Text>
      <Text style={s.subtitle}>
        Enter your registered email address and we will send you a link to reset your password.
      </Text>

      {!sent ? (
        <View style={s.form}>
          <Input
            label="Email address"
            placeholder="name@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrorMsg('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            tone="dark"
          />

          {!!errorMsg && (
            <View style={s.errorBox}>
              <Icon name="alert-circle" size={16} color="#EF4444" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}

          <AppButton
            label={loading ? 'Sending link...' : 'Send Reset Link'}
            onPress={handleSendReset}
            disabled={loading}
            style={s.btn}
          />
          {loading && <ActivityIndicator style={{ marginTop: 8 }} color="#00D084" />}
        </View>
      ) : (
        <View style={s.successBox}>
          <Icon name="checkmark-circle" size={40} color="#00D084" />
          <Text style={s.successTitle}>Check Your Email</Text>
          <Text style={s.successMsg}>
            A password reset link has been sent to{' '}
            <Text style={s.emailHighlight}>{email}</Text>. The link expires in 1 hour.
          </Text>

          {!!devToken && (
            <View style={s.devBox}>
              <Text style={s.devTitle}>Direct Dev Access Token</Text>
              <Text style={s.devToken} selectable>
                {devToken}
              </Text>
              <AppButton
                label="Set New Password Now →"
                onPress={handleGoToReset}
                style={s.devBtn}
              />
            </View>
          )}

          <Pressable
            onPress={() => {
              setSent(false);
              setDevToken('');
            }}
            style={s.resendBtn}
          >
            <Text style={s.resendText}>Didn't receive it? Try again</Text>
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={s.backToLoginBtn}>
            <Text style={s.backToLoginText}>← Back to Login</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

interface Styles {
  back: ViewStyle;
  backText: TextStyle;
  iconWrap: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  form: ViewStyle;
  errorBox: ViewStyle;
  errorText: TextStyle;
  btn: ViewStyle;
  successBox: ViewStyle;
  successTitle: TextStyle;
  successMsg: TextStyle;
  emailHighlight: TextStyle;
  devBox: ViewStyle;
  devTitle: TextStyle;
  devToken: TextStyle;
  devBtn: ViewStyle;
  resendBtn: ViewStyle;
  resendText: TextStyle;
  backToLoginBtn: ViewStyle;
  backToLoginText: TextStyle;
}

const s = StyleSheet.create<Styles>({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  backText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.25)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    flex: 1,
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
  },
  successBox: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successMsg: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailHighlight: {
    color: '#00D084',
    fontWeight: '700',
  },
  devBox: {
    width: '100%',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FACC15',
  },
  devToken: {
    fontSize: 11,
    color: '#FEF08A',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 6,
  },
  devBtn: {
    marginTop: 4,
  },
  resendBtn: {
    marginTop: 12,
    padding: 6,
  },
  resendText: {
    color: '#00D084',
    fontSize: 13,
    fontWeight: '600',
  },
  backToLoginBtn: {
    marginTop: 4,
    padding: 6,
  },
  backToLoginText: {
    color: '#64748B',
    fontSize: 13,
  },
});
