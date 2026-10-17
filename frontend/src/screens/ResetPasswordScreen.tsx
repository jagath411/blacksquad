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
import { fonts } from '../theme/fonts';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, token: initialToken } = route.params;
  const [token, setToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleReset = async () => {
    setErrorMsg('');
    if (!token.trim()) {
      setErrorMsg('Please enter the reset token.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          newPassword,
        }),
      });
      setDone(true);
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen tone="dark">
      <Pressable style={s.back} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={20} color="#5B6573" />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      <View style={s.iconWrap}>
        <Icon name="key" size={38} color="#1E8E5A" />
      </View>
      <Text style={s.title}>Set New Password</Text>
      <Text style={s.subtitle}>
        Create a new password for <Text style={s.emailHighlight}>{email}</Text>
      </Text>

      {!done ? (
        <View style={s.form}>
          {!initialToken && (
            <Input
              label="Reset Token"
              placeholder="Paste security reset token"
              value={token}
              onChangeText={(t) => {
                setToken(t);
                setErrorMsg('');
              }}
              autoCapitalize="none"
              tone="dark"
            />
          )}

          <Input
            label="New password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={(t) => {
              setNewPassword(t);
              setErrorMsg('');
            }}
            secureTextEntry
            tone="dark"
          />

          <Input
            label="Confirm password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              setErrorMsg('');
            }}
            secureTextEntry
            tone="dark"
          />

          {!!errorMsg && (
            <View style={s.errorBox}>
              <Icon name="alert-circle" size={16} color="#C8372D" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}

          <AppButton
            label={loading ? 'Updating password...' : 'Set New Password'}
            onPress={handleReset}
            disabled={loading}
            style={s.btn}
          />
          {loading && <ActivityIndicator style={{ marginTop: 8 }} color="#1E8E5A" />}
        </View>
      ) : (
        <View style={s.successBox}>
          <Icon name="checkmark-circle" size={44} color="#1E8E5A" />
          <Text style={s.successTitle}>Password Updated!</Text>
          <Text style={s.successMsg}>
            Your password has been changed successfully. You can now sign in with your new credentials.
          </Text>
          <AppButton
            label="Sign In Now"
            onPress={() => navigation.navigate('Login', { role: 'CUSTOMER' })}
            style={s.btn}
          />
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
  emailHighlight: TextStyle;
  form: ViewStyle;
  errorBox: ViewStyle;
  errorText: TextStyle;
  btn: ViewStyle;
  successBox: ViewStyle;
  successTitle: TextStyle;
  successMsg: TextStyle;
}

const s = StyleSheet.create<Styles>({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  backText: {
    color: '#5B6573',
    fontSize: 14, fontFamily: fonts.w400,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(31, 63, 184, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(31, 63, 184, 0.22)',
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.w700,
    color: '#1D232B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13, fontFamily: fonts.w400,
    color: '#5B6573',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  emailHighlight: {
    color: '#1E8E5A',
    fontFamily: fonts.w600,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(200, 55, 45, 0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 55, 45, 0.30)',
  },
  errorText: {
    flex: 1,
    color: '#C8372D',
    fontSize: 13, fontFamily: fonts.w400,
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
  },
  successBox: {
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: fonts.w700,
    color: '#1D232B',
  },
  successMsg: {
    fontSize: 13, fontFamily: fonts.w400,
    color: '#5B6573',
    textAlign: 'center',
    lineHeight: 20,
  },
});
