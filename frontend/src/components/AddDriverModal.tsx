import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from './ui/Icon';
import { AppButton } from './AppButton';
import { Input } from './ui/Input';
import { darkColors, radius, spacing } from '../theme';
import { onboardDriver, type OnboardDriverPayload } from '../services/driverService';
import { formatUnifiedError } from '../utils/errorHandler';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDriverAdded: () => void;
  onShowNotification: (title: string, body: string, type: 'success' | 'error' | 'info') => void;
}

const VEHICLE_TYPES: Array<'SEDAN' | 'SUV' | 'VAN' | 'TRUCK'> = ['SEDAN', 'SUV', 'VAN', 'TRUCK'];

export function AddDriverModal({ visible, onClose, onDriverAdded, onShowNotification }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [license, setLicense] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState<'SEDAN' | 'SUV' | 'VAN' | 'TRUCK'>('SEDAN');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{
    driverName: string;
    phone: string;
    otp: string;
  } | null>(null);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setLicense('');
    setVehicleReg('');
    setVehicleModel('');
    setVehicleType('SEDAN');
    setErrorMessage('');
    setSuccessInfo(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim().replace(/[\s-]/g, '');

    if (!trimmedName) {
      setErrorMessage('Please enter the driver full name.');
      return;
    }

    if (!trimmedPhone || trimmedPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Format phone with +91 if not provided
    const formattedPhone = trimmedPhone.startsWith('+')
      ? trimmedPhone
      : `+91${trimmedPhone.replace(/^0+/, '')}`;

    setLoading(true);
    try {
      const payload: OnboardDriverPayload = {
        name: trimmedName,
        phoneNumber: formattedPhone,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        licenseNumber: license.trim() || undefined,
        vehicleRegistration: vehicleReg.trim() ? vehicleReg.trim().toUpperCase() : undefined,
        vehicleModel: vehicleModel.trim() || undefined,
        vehicleType,
      };

      const result = await onboardDriver(payload);

      setSuccessInfo({
        driverName: trimmedName,
        phone: formattedPhone,
        otp: result.smsDispatched?.welcomeOtp || '123456',
      });

      onDriverAdded();
      onShowNotification(
        'Driver Partner Added',
        `${trimmedName} (${formattedPhone}) has been added to your fleet. Welcome SMS invite sent.`,
        'success'
      );
    } catch (e: any) {
      const err = formatUnifiedError(e);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIconBox}>
              <Icon name="person-add" size={20} color="#00D084" />
            </View>
            <View>
              <Text style={s.headerTitle}>Add Fleet Driver</Text>
              <Text style={s.headerSubtitle}>Register partner & dispatch SMS login invite</Text>
            </View>
          </View>
          <Pressable style={s.closeBtn} onPress={handleClose}>
            <Icon name="close" size={20} color="#94A3B8" />
          </Pressable>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {successInfo ? (
            <View style={s.successCard}>
              <View style={s.successIconWrap}>
                <Icon name="checkmark-circle" size={44} color="#00D084" />
              </View>
              <Text style={s.successHeading}>Driver Onboarded!</Text>
              <Text style={s.successBody}>
                <Text style={{ fontWeight: '700', color: '#F1F5F9' }}>{successInfo.driverName}</Text> is
                now active in your fleet.
              </Text>

              <View style={s.smsNoticeBox}>
                <View style={s.smsNoticeHeader}>
                  <Icon name="chatbubble" size={16} color="#38BDF8" />
                  <Text style={s.smsNoticeTitle}>SMS Invite Dispatched</Text>
                </View>
                <Text style={s.smsNoticePhone}>To: {successInfo.phone}</Text>
                <View style={s.otpBox}>
                  <Text style={s.otpBoxLabel}>One-Time Login Access OTP:</Text>
                  <Text style={s.otpCodeText} selectable>{successInfo.otp}</Text>
                </View>
                <Text style={s.smsNoticeFooter}>
                  The driver can immediately login by opening the app and entering their phone number.
                </Text>
              </View>

              <AppButton
                label="Add Another Driver"
                onPress={resetForm}
                style={{ marginTop: 16 }}
              />
              <Pressable style={s.doneBtn} onPress={handleClose}>
                <Text style={s.doneBtnText}>Back to Fleet Dashboard</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.sectionHeader}>PERSONAL & CONTACT DETAILS</Text>

              <Input
                label="Full Name *"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setErrorMessage('');
                }}
                autoCapitalize="words"
                tone="dark"
              />

              <Input
                label="Mobile Phone Number *"
                placeholder="e.g. 9876543210 or +919876543210"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setErrorMessage('');
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                tone="dark"
              />

              <Input
                label="Email Address (Optional)"
                placeholder="driver@gmail.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                tone="dark"
              />

              <Text style={[s.sectionHeader, { marginTop: 12 }]}>DRIVER LICENSE & CREDENTIALS</Text>

              <Input
                label="Driving License Number"
                placeholder="e.g. KA-01-2024-0012345"
                value={license}
                onChangeText={(t) => {
                  setLicense(t);
                  setErrorMessage('');
                }}
                autoCapitalize="characters"
                tone="dark"
              />

              <Text style={[s.sectionHeader, { marginTop: 12 }]}>VEHICLE ASSIGNMENT (OPTIONAL)</Text>

              <Input
                label="Vehicle Registration Number"
                placeholder="e.g. KA-01-EQ-9999"
                value={vehicleReg}
                onChangeText={(t) => {
                  setVehicleReg(t);
                  setErrorMessage('');
                }}
                autoCapitalize="characters"
                tone="dark"
              />

              <Input
                label="Vehicle Make & Model"
                placeholder="e.g. Toyota Innova Crysta, Maruti Dzire"
                value={vehicleModel}
                onChangeText={(t) => {
                  setVehicleModel(t);
                  setErrorMessage('');
                }}
                autoCapitalize="words"
                tone="dark"
              />

              <Text style={s.fieldLabel}>Vehicle Category</Text>
              <View style={s.typesRow}>
                {VEHICLE_TYPES.map((type) => {
                  const active = vehicleType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[s.typePill, active && s.typePillActive]}
                      onPress={() => setVehicleType(type)}
                    >
                      <Icon
                        name={type === 'SEDAN' ? 'car' : type === 'SUV' ? 'car-sport' : type === 'VAN' ? 'bus' : 'cube'}
                        size={14}
                        color={active ? '#00D084' : '#94A3B8'}
                      />
                      <Text style={[s.typePillText, active && s.typePillTextActive]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {!!errorMessage && (
                <View style={s.errorBox}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={s.errorText}>{errorMessage}</Text>
                </View>
              )}

              <View style={s.actionRow}>
                <AppButton
                  label={loading ? 'Adding driver...' : 'Onboard Driver Partner →'}
                  onPress={handleSubmit}
                  disabled={loading}
                  style={s.submitBtn}
                />
                {loading && <ActivityIndicator style={{ marginTop: 8 }} color="#00D084" />}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
interface Styles {
  root: ViewStyle;
  header: ViewStyle;
  headerLeft: ViewStyle;
  headerIconBox: ViewStyle;
  headerTitle: TextStyle;
  headerSubtitle: TextStyle;
  closeBtn: ViewStyle;
  scroll: ViewStyle;
  scrollContent: ViewStyle;
  form: ViewStyle;
  sectionHeader: TextStyle;
  fieldLabel: TextStyle;
  typesRow: ViewStyle;
  typePill: ViewStyle;
  typePillActive: ViewStyle;
  typePillText: TextStyle;
  typePillTextActive: TextStyle;
  errorBox: ViewStyle;
  errorText: TextStyle;
  actionRow: ViewStyle;
  submitBtn: ViewStyle;
  successCard: ViewStyle;
  successIconWrap: ViewStyle;
  successHeading: TextStyle;
  successBody: TextStyle;
  smsNoticeBox: ViewStyle;
  smsNoticeHeader: ViewStyle;
  smsNoticeTitle: TextStyle;
  smsNoticePhone: TextStyle;
  otpBox: ViewStyle;
  otpBoxLabel: TextStyle;
  otpCodeText: TextStyle;
  smsNoticeFooter: TextStyle;
  doneBtn: ViewStyle;
  doneBtnText: TextStyle;
}

const s = StyleSheet.create<Styles>({
  root: {
    flex: 1,
    backgroundColor: '#07100D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0D1A14',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.3)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  form: {
    gap: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00D084',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  typesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typePillActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    borderColor: '#00D084',
  },
  typePillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  typePillTextActive: {
    color: '#00D084',
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
  actionRow: {
    marginTop: 10,
  },
  submitBtn: {
    marginTop: 4,
  },
  successCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.2)',
    gap: 12,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successBody: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  smsNoticeBox: {
    width: '100%',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginTop: 4,
  },
  smsNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smsNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  smsNoticePhone: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  otpBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otpBoxLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  otpCodeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00D084',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 3,
  },
  smsNoticeFooter: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    marginTop: 4,
  },
  doneBtn: {
    marginTop: 8,
    padding: 8,
  },
  doneBtnText: {
    color: '#64748B',
    fontSize: 13,
  },
});
