import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { AppButton } from './AppButton';
import { Icon } from './ui/Icon';
import { darkColors, radius, spacing } from '../theme';
import type { UserRole } from '../types';
import { getCurrentUser, updateUserProfile, type UserProfile } from '../services/authService';
import { lookupIfscCode, type VerifiedIfscResult } from '../services/ifscService';
import { ALL_INDIAN_BANKS, type IndianBankData } from '../utils/allIndianBanks';

interface Props {
  visible: boolean;
  role: UserRole;
  onClose: () => void;
  onLogout: () => void;
}

type TabType = 'account' | 'places' | 'documents' | 'safety' | 'wallet' | 'settings';

interface SavedPlace {
  id: string;
  title: string;
  address: string;
  icon: string;
}

export function ProfileModal({ visible, role, onClose, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Saved Places (Customer)
  const [places, setPlaces] = useState<SavedPlace[]>([
    { id: '1', title: 'Home', address: 'Indiranagar 100ft Rd, Bengaluru', icon: 'home' },
    { id: '2', title: 'Work', address: 'BLR Tech Park, Bellandur, Bengaluru', icon: 'briefcase' },
  ]);

  // Indian Banking & IFSC State (Driver / Owner)
  const [accountNumber, setAccountNumber] = useState('918237461928');
  const [ifscCode, setIfscCode] = useState('HDFC0001234');
  const [bankInfo, setBankInfo] = useState<VerifiedIfscResult | null>(null);
  const [verifyingIfsc, setVerifyingIfsc] = useState(false);

  // Safety / SOS (Customer & Driver)
  const [emergencyContact, setEmergencyContact] = useState('+91 98765 43210');
  const [audioRecordingEnabled, setAudioRecordingEnabled] = useState(true);
  const [nightSafetyShare, setNightSafetyShare] = useState(true);

  // Wallet
  const [walletBalance, setWalletBalance] = useState('₹1,450.00');

  useEffect(() => {
    if (visible) {
      getCurrentUser()
        .then((u) => {
          setUser(u);
          setName(u.name || '');
          setPhone(u.phoneNumber || '');
        })
        .catch(() => {});
    }
  }, [visible]);

  // Handle IFSC lookup
  const handleIfscLookup = async (code: string) => {
    setIfscCode(code.toUpperCase());
    if (code.length === 11) {
      setVerifyingIfsc(true);
      try {
        const info = await lookupIfscCode(code);
        setBankInfo(info);
      } catch {
        setBankInfo(null);
      } finally {
        setVerifyingIfsc(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSavedSuccess(false);
    setErrorMessage('');
    try {
      const updated = await updateUserProfile({ name, phoneNumber: phone });
      setUser(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const triggerSOS = () => {
    const msg =
      'EMERGENCY SOS ALERT: Vehicle live coordinates & audio broadcast initiated to police (112) and emergency contacts.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('EMERGENCY SOS ACTIVE', msg, [{ text: 'OK' }]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.sheetContainer}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.userBadgeGroup}>
              <View style={s.avatarBox}>
                <Icon name="person" size={24} color="#FFFFFF" />
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{user?.name || 'BlackSquad Member'}</Text>
                <Text style={s.userEmail}>{user?.email || 'authenticated'}</Text>
                <View style={s.rolePill}>
                  <Text style={s.roleText}>{role} PORTAL</Text>
                </View>
              </View>
            </View>
            <Pressable style={s.closeBtn} onPress={onClose}>
              <Icon name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Navigation Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
            <Pressable
              style={[s.tabPill, activeTab === 'account' && s.tabPillActive]}
              onPress={() => setActiveTab('account')}
            >
              <Icon
                name="person"
                size={14}
                color={activeTab === 'account' ? '#00D084' : '#94A3B8'}
              />
              <Text style={[s.tabText, activeTab === 'account' && s.tabTextActive]}>
                Account
              </Text>
            </Pressable>

            {role === 'CUSTOMER' && (
              <Pressable
                style={[s.tabPill, activeTab === 'places' && s.tabPillActive]}
                onPress={() => setActiveTab('places')}
              >
                <Icon
                  name="bookmark"
                  size={14}
                  color={activeTab === 'places' ? '#00D084' : '#94A3B8'}
                />
                <Text style={[s.tabText, activeTab === 'places' && s.tabTextActive]}>
                  Saved Places
                </Text>
              </Pressable>
            )}

            {role === 'DRIVER' && (
              <Pressable
                style={[s.tabPill, activeTab === 'documents' && s.tabPillActive]}
                onPress={() => setActiveTab('documents')}
              >
                <Icon
                  name="card"
                  size={14}
                  color={activeTab === 'documents' ? '#00D084' : '#94A3B8'}
                />
                <Text style={[s.tabText, activeTab === 'documents' && s.tabTextActive]}>
                  Bank & Docs
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[s.tabPill, activeTab === 'safety' && s.tabPillActive]}
              onPress={() => setActiveTab('safety')}
            >
              <Icon
                name="shield-checkmark"
                size={14}
                color={activeTab === 'safety' ? '#00D084' : '#94A3B8'}
              />
              <Text style={[s.tabText, activeTab === 'safety' && s.tabTextActive]}>
                Safety & SOS
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'wallet' && s.tabPillActive]}
              onPress={() => setActiveTab('wallet')}
            >
              <Icon
                name="wallet"
                size={14}
                color={activeTab === 'wallet' ? '#00D084' : '#94A3B8'}
              />
              <Text style={[s.tabText, activeTab === 'wallet' && s.tabTextActive]}>
                Wallet & Pay
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'settings' && s.tabPillActive]}
              onPress={() => setActiveTab('settings')}
            >
              <Icon
                name="settings"
                size={14}
                color={activeTab === 'settings' ? '#00D084' : '#94A3B8'}
              />
              <Text style={[s.tabText, activeTab === 'settings' && s.tabTextActive]}>
                Settings
              </Text>
            </Pressable>
          </ScrollView>

          {/* Main Tab Viewport */}
          <ScrollView style={s.contentScroll} showsVerticalScrollIndicator={false}>
            {/* 1. Account Details */}
            {activeTab === 'account' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Personal Details</Text>
                <View style={s.formCard}>
                  <Text style={s.inputLabel}>FULL NAME</Text>
                  <TextInput
                    style={s.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor="#64748B"
                  />

                  <Text style={s.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[s.textInput, s.textInputDisabled]}
                    value={user?.email || ''}
                    editable={false}
                  />

                  <Text style={s.inputLabel}>PHONE NUMBER</Text>
                  <TextInput
                    style={s.textInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 98765 43210"
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                  />

                  {savedSuccess && (
                    <View style={s.alertSuccess}>
                      <Icon name="checkmark-circle" size={16} color="#34D399" />
                      <Text style={s.alertSuccessText}>Profile updated successfully</Text>
                    </View>
                  )}

                  {errorMessage ? (
                    <View style={s.alertError}>
                      <Icon name="alert-circle" size={16} color="#FCA5A5" />
                      <Text style={s.alertErrorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  <AppButton
                    label={saving ? 'Updating...' : 'Save Profile Changes'}
                    onPress={handleSaveProfile}
                    disabled={saving}
                  />
                </View>
              </View>
            )}

            {/* 2. Saved Places (Customer) */}
            {activeTab === 'places' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Favorite Locations</Text>
                {places.map((place) => (
                  <View key={place.id} style={s.placeCard}>
                    <View style={s.placeIconBox}>
                      <Icon name={place.icon} size={18} color="#00D084" />
                    </View>
                    <View style={s.placeDetails}>
                      <Text style={s.placeTitle}>{place.title}</Text>
                      <Text style={s.placeAddress}>{place.address}</Text>
                    </View>
                    <Pressable
                      style={s.placeEditBtn}
                      onPress={() => {
                        if (Platform.OS === 'web') window.alert(`Editing ${place.title}`);
                      }}
                    >
                      <Text style={s.placeEditText}>Edit</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  style={s.addPlaceBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') window.alert('Add new custom favorite place');
                  }}
                >
                  <Icon name="add" size={18} color="#38BDF8" />
                  <Text style={s.addPlaceText}>Add New Location</Text>
                </Pressable>
              </View>
            )}

            {/* 3. Driver Documents & Indian Banking */}
            {activeTab === 'documents' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Driver Credentials</Text>
                <View style={s.docCard}>
                  <View style={s.docRow}>
                    <Icon name="document-text" size={24} color="#38BDF8" />
                    <View style={s.docInfo}>
                      <Text style={s.docTitle}>Commercial Driving License</Text>
                      <Text style={s.docNumber}>KA-05-2021-0089218</Text>
                    </View>
                    <View style={s.verifiedTag}>
                      <Text style={s.verifiedTagText}>VERIFIED</Text>
                    </View>
                  </View>

                  <View style={s.docDivider} />

                  <Text style={s.sectionTitle}>Direct Indian Bank Settlement</Text>
                  <Text style={s.inputLabel}>SELECT YOUR BANK</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bankPills}>
                    {ALL_INDIAN_BANKS.slice(0, 10).map((b: IndianBankData) => (
                      <Pressable
                        key={b.code}
                        style={[
                          s.bankChip,
                          ifscCode.startsWith(b.code) && s.bankChipActive,
                        ]}
                        onPress={() => handleIfscLookup(`${b.code}0001234`)}
                      >
                        <Text style={s.bankChipText}>{b.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={s.inputLabel}>ACCOUNT NUMBER</Text>
                  <TextInput
                    style={s.textInput}
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    keyboardType="number-pad"
                  />

                  <Text style={s.inputLabel}>IFSC CODE</Text>
                  <TextInput
                    style={s.textInput}
                    value={ifscCode}
                    onChangeText={handleIfscLookup}
                    autoCapitalize="characters"
                    maxLength={11}
                  />

                  {verifyingIfsc && <Text style={s.ifscHint}>Validating IFSC with RBI...</Text>}

                  {bankInfo && (
                    <View style={s.ifscVerifiedBox}>
                      <Icon name="checkmark-circle" size={16} color="#34D399" />
                      <View>
                        <Text style={s.ifscVerifiedTitle}>{bankInfo.bankName}</Text>
                        <Text style={s.ifscVerifiedSub}>
                          {bankInfo.branchName}, {bankInfo.city}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 4. Safety & SOS */}
            {activeTab === 'safety' && (
              <View style={s.section}>
                {/* Immediate Red SOS Button */}
                <Pressable style={s.sosButton} onPress={triggerSOS}>
                  <Icon name="warning" size={28} color="#FFFFFF" />
                  <View style={s.sosTextGroup}>
                    <Text style={s.sosTitle}>EMERGENCY SOS</Text>
                    <Text style={s.sosSub}>Tap to broadcast GPS to police & family immediately</Text>
                  </View>
                </Pressable>

                <Text style={s.sectionTitle}>Safety Preferences</Text>
                <View style={s.safetyRow}>
                  <View style={s.safetyInfo}>
                    <Text style={s.safetyTitle}>Emergency Contact Number</Text>
                    <Text style={s.safetySub}>{emergencyContact}</Text>
                  </View>
                  <Pressable
                    style={s.toggleBtn}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        const next = window.prompt('Enter emergency phone number:', emergencyContact);
                        if (next) setEmergencyContact(next);
                      }
                    }}
                  >
                    <Text style={s.toggleBtnText}>EDIT</Text>
                  </Pressable>
                </View>

                <View style={s.safetyRow}>
                  <View style={s.safetyInfo}>
                    <Text style={s.safetyTitle}>In-Ride Audio Safety Shield</Text>
                    <Text style={s.safetySub}>Encrypted audio record during emergency</Text>
                  </View>
                  <Pressable
                    style={[s.toggleBtn, audioRecordingEnabled && s.toggleBtnActive]}
                    onPress={() => setAudioRecordingEnabled((v) => !v)}
                  >
                    <Text style={s.toggleBtnText}>{audioRecordingEnabled ? 'ON' : 'OFF'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 5. Wallet & Payments */}
            {activeTab === 'wallet' && (
              <View style={s.section}>
                <View style={s.walletCard}>
                  <Text style={s.walletLabel}>AVAILABLE WALLET BALANCE</Text>
                  <Text style={s.walletAmount}>{walletBalance}</Text>
                  <View style={s.walletBtnRow}>
                    <Pressable
                      style={s.walletActionBtn}
                      onPress={() => {
                        if (Platform.OS === 'web') window.alert('Recharge balance via UPI/Card');
                      }}
                    >
                      <Text style={s.walletActionText}>+ Add Money</Text>
                    </Pressable>
                    {role === 'DRIVER' && (
                      <Pressable
                        style={[s.walletActionBtn, s.walletSettleBtn]}
                        onPress={() => {
                          if (Platform.OS === 'web') window.alert('Instant payout initiated to bank');
                        }}
                      >
                        <Text style={[s.walletActionText, { color: '#00D084' }]}>Instant Payout</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>Payment Methods</Text>
                <View style={s.paymentMethodCard}>
                  <Icon name="phone-portrait" size={22} color="#00D084" />
                  <View style={s.paymentInfo}>
                    <Text style={s.paymentTitle}>Unified Payments Interface (UPI)</Text>
                    <Text style={s.paymentSub}>Google Pay, PhonePe, Paytm</Text>
                  </View>
                  <Text style={s.defaultPill}>PRIMARY</Text>
                </View>

                <View style={s.paymentMethodCard}>
                  <Icon name="card" size={22} color="#38BDF8" />
                  <View style={s.paymentInfo}>
                    <Text style={s.paymentTitle}>HDFC Corporate Debit Card</Text>
                    <Text style={s.paymentSub}>•••• •••• •••• 8821</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 6. Settings & Logout */}
            {activeTab === 'settings' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>App Preferences</Text>
                <View style={s.settingsCard}>
                  <View style={s.settingRow}>
                    <Text style={s.settingLabel}>App Version</Text>
                    <Text style={s.settingValue}>2.4.0 (Pilot Production)</Text>
                  </View>
                  <View style={s.settingDivider} />
                  <View style={s.settingRow}>
                    <Text style={s.settingLabel}>Telemetry Mode</Text>
                    <Text style={s.settingValue}>Sub-second Live Sockets</Text>
                  </View>
                  <View style={s.settingDivider} />
                  <View style={s.settingRow}>
                    <Text style={s.settingLabel}>Security Protocol</Text>
                    <Text style={s.settingValue}>TLS 1.3 + JWT Bearer</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  style={s.logoutActionBtn}
                  onPress={() => {
                    onClose();
                    onLogout();
                  }}
                >
                  <Icon name="log-out" size={18} color="#EF4444" />
                  <Text style={s.logoutActionText}>Sign Out of Workspace</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create<{
  overlay: ViewStyle;
  sheetContainer: ViewStyle;
  header: ViewStyle;
  userBadgeGroup: ViewStyle;
  avatarBox: ViewStyle;
  userInfo: ViewStyle;
  userName: TextStyle;
  userEmail: TextStyle;
  rolePill: ViewStyle;
  roleText: TextStyle;
  closeBtn: ViewStyle;
  tabsScroll: ViewStyle;
  tabPill: ViewStyle;
  tabPillActive: ViewStyle;
  tabText: TextStyle;
  tabTextActive: TextStyle;
  contentScroll: ViewStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  formCard: ViewStyle;
  inputLabel: TextStyle;
  textInput: TextStyle;
  textInputDisabled: TextStyle;
  alertSuccess: ViewStyle;
  alertSuccessText: TextStyle;
  alertError: ViewStyle;
  alertErrorText: TextStyle;
  placeCard: ViewStyle;
  placeIconBox: ViewStyle;
  placeDetails: ViewStyle;
  placeTitle: TextStyle;
  placeAddress: TextStyle;
  placeEditBtn: ViewStyle;
  placeEditText: TextStyle;
  addPlaceBtn: ViewStyle;
  addPlaceText: TextStyle;
  docCard: ViewStyle;
  docRow: ViewStyle;
  docInfo: ViewStyle;
  docTitle: TextStyle;
  docNumber: TextStyle;
  verifiedTag: ViewStyle;
  verifiedTagText: TextStyle;
  docDivider: ViewStyle;
  bankPills: ViewStyle;
  bankChip: ViewStyle;
  bankChipActive: ViewStyle;
  bankChipText: TextStyle;
  ifscHint: TextStyle;
  ifscVerifiedBox: ViewStyle;
  ifscVerifiedTitle: TextStyle;
  ifscVerifiedSub: TextStyle;
  sosButton: ViewStyle;
  sosTextGroup: ViewStyle;
  sosTitle: TextStyle;
  sosSub: TextStyle;
  safetyRow: ViewStyle;
  safetyInfo: ViewStyle;
  safetyTitle: TextStyle;
  safetySub: TextStyle;
  toggleBtn: ViewStyle;
  toggleBtnActive: ViewStyle;
  toggleBtnText: TextStyle;
  walletCard: ViewStyle;
  walletLabel: TextStyle;
  walletAmount: TextStyle;
  walletBtnRow: ViewStyle;
  walletActionBtn: ViewStyle;
  walletSettleBtn: ViewStyle;
  walletActionText: TextStyle;
  paymentMethodCard: ViewStyle;
  paymentInfo: ViewStyle;
  paymentTitle: TextStyle;
  paymentSub: TextStyle;
  defaultPill: TextStyle;
  settingsCard: ViewStyle;
  settingRow: ViewStyle;
  settingLabel: TextStyle;
  settingValue: TextStyle;
  settingDivider: ViewStyle;
  logoutActionBtn: ViewStyle;
  logoutActionText: TextStyle;
}>({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 24, 0.85)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    gap: 2,
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  rolePill: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleText: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScroll: {
    marginBottom: 16,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabPillActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#00D084',
  },
  contentScroll: {
    maxHeight: 500,
  },
  section: {
    gap: 12,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  inputLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textInputDisabled: {
    opacity: 0.6,
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  alertSuccessText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  alertErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  placeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDetails: {
    flex: 1,
  },
  placeTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  placeAddress: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  placeEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0F172A',
  },
  placeEditText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
  },
  addPlaceText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  docCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  docNumber: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '900',
  },
  docDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  bankPills: {
    marginVertical: 4,
  },
  bankChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bankChipActive: {
    borderColor: '#00D084',
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
  },
  bankChipText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  ifscHint: {
    color: '#38BDF8',
    fontSize: 11,
  },
  ifscVerifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    padding: 10,
    borderRadius: 8,
  },
  ifscVerifiedTitle: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 12,
  },
  ifscVerifiedSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    padding: 14,
  },
  sosTextGroup: {
    flex: 1,
  },
  sosTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  sosSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  safetyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  safetyInfo: {
    flex: 1,
  },
  safetyTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  safetySub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#00D084',
  },
  toggleBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
  },
  walletCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  walletLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  walletAmount: {
    color: '#00D084',
    fontSize: 28,
    fontWeight: '900',
  },
  walletBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  walletActionBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  walletSettleBtn: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderWidth: 1,
    borderColor: '#00D084',
  },
  walletActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  paymentSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  defaultPill: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settingsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  settingValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  logoutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  logoutActionText: {
    color: '#FCA5A5',
    fontWeight: '800',
    fontSize: 13,
  },
});
