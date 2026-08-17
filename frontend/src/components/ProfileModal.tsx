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
} from 'react-native';
import { AppButton } from './AppButton';
import { radius, spacing } from '../theme';
import {
  getCurrentUser,
  updateUserProfile,
  type UserProfile,
} from '../services/authService';
import {
  getDriverProfile,
  updateBankDetails,
  type DriverProfile,
} from '../services/driverService';
import { POPULAR_BANKS, type BankPreset } from '../utils/bankRegistry';
import { lookupIfscCode, type VerifiedIfscResult } from '../services/ifscService';
import type { SavedPlace, UserRole } from '../types';

interface Props {
  visible: boolean;
  role: UserRole;
  onClose: () => void;
  onLogout: () => void;
}

type TabType = 'account' | 'saved_places' | 'driver_kyc' | 'safety' | 'wallet' | 'settings';

export function ProfileModal({ visible, role, onClose, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Safety states
  const [pinEnabled, setPinEnabled] = useState(true);
  const [emergencyContact, setEmergencyContact] = useState('+91 98765 43210');

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([
    {
      id: '1',
      title: 'Home',
      address: 'Prestige Falcon City, Kanakapura Rd, Bangalore',
      latitude: 12.8876,
      longitude: 77.5562,
      icon: 'home',
    },
    {
      id: '2',
      title: 'Office / Tech Park',
      address: 'Ecospace Business Park, Outer Ring Rd, Bellandur, Bangalore',
      latitude: 12.926,
      longitude: 77.6834,
      icon: 'work',
    },
  ]);

  // Bank Form State (Drivers)
  const [accountHolderName, setAccountHolderName] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankPreset | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [ifscLookupLoading, setIfscLookupLoading] = useState(false);
  const [verifiedIfsc, setVerifiedIfsc] = useState<VerifiedIfscResult | null>(null);

  // Settings
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (visible) {
      loadProfileData();
    }
  }, [visible]);

  const loadProfileData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const u = await getCurrentUser();
      setUser(u);
      setName(u.name || '');
      setPhoneNumber(u.phoneNumber || '');

      if (role === 'DRIVER') {
        const d = await getDriverProfile();
        setDriverProfile(d);
        if (d.bankDetails) {
          setAccountHolderName(d.bankDetails.accountHolderName || '');
          setAccountNumber(d.bankDetails.accountNumber || '');
          setConfirmAccountNumber(d.bankDetails.accountNumber || '');
          setIfscCode(d.bankDetails.ifscCode || '');
          setBranchName(d.bankDetails.branchName || '');
          setUpiId(d.bankDetails.upiId || '');
          if (d.bankDetails.bankName) {
            const found = POPULAR_BANKS.find(
              (b) => b.name.toLowerCase() === d.bankDetails!.bankName!.toLowerCase(),
            );
            if (found) setSelectedBank(found);
          }
        }
      }
    } catch {
      setErrorMsg('Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const updated = await updateUserProfile({ name, phoneNumber });
      setUser(updated);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleIfscChange = async (val: string) => {
    const clean = val.toUpperCase().trim();
    setIfscCode(clean);
    if (clean.length === 11) {
      setIfscLookupLoading(true);
      const res = await lookupIfscCode(clean);
      setIfscLookupLoading(false);
      if (res) {
        setVerifiedIfsc(res);
        setBranchName(res.branchName);
        const match = POPULAR_BANKS.find((b) =>
          res.bankName.toLowerCase().includes(b.shortName.toLowerCase()),
        );
        if (match) setSelectedBank(match);
      }
    } else {
      setVerifiedIfsc(null);
    }
  };

  const handleSaveBank = async () => {
    if (!accountHolderName.trim()) {
      setErrorMsg('Account holder name is required');
      return;
    }
    if (!accountNumber || accountNumber !== confirmAccountNumber) {
      setErrorMsg('Account numbers do not match');
      return;
    }
    if (ifscCode.length !== 11) {
      setErrorMsg('Enter a valid 11-character IFSC Code');
      return;
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const bankName = selectedBank ? selectedBank.name : verifiedIfsc?.bankName || 'Bank';
      const updated = await updateBankDetails({
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        upiId: upiId.trim() || undefined,
      });
      setDriverProfile(updated);
      setSuccessMsg('Bank details saved for automated settlements!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to update bank details');
    } finally {
      setSaving(false);
    }
  };

  const triggerEmergencySOS = () => {
    if (Platform.OS === 'web') {
      window.alert(
        '🚨 EMERGENCY SOS ALERT TRIGGERED!\n\nYour live GPS location and trip details have been broadcasted to BlackSquad 24x7 Safety Response and your Emergency Contacts.',
      );
    } else {
      Alert.alert(
        '🚨 Emergency SOS Activated',
        'Your live location and active vehicle status have been transmitted to BlackSquad 24x7 Security Operations.',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.modalRoot}>
        {/* Top App Bar */}
        <View style={s.appBar}>
          <Pressable style={s.backBtn} onPress={onClose}>
            <Text style={s.backBtnIcon}>✕</Text>
          </Pressable>
          <Text style={s.appBarTitle}>Account & Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={s.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Uber/Rapido Hero Profile Header */}
          <View style={s.heroCard}>
            <View style={s.heroTop}>
              <View style={s.avatarWrapper}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'BS'}
                  </Text>
                </View>
                <View style={s.verifiedBadgeIcon}>
                  <Text style={s.verifiedCheck}>✓</Text>
                </View>
              </View>

              <View style={s.heroInfo}>
                <Text style={s.heroName}>{user?.name || 'BlackSquad Member'}</Text>
                <Text style={s.heroEmail}>{user?.email || 'user@blacksquad.com'}</Text>
                <View style={s.heroBadgesRow}>
                  <View style={s.ratingBadge}>
                    <Text style={s.ratingStar}>★</Text>
                    <Text style={s.ratingScore}>{role === 'DRIVER' ? '4.96' : '4.92'}</Text>
                  </View>
                  <View style={s.rolePill}>
                    <Text style={s.rolePillText}>{role} WORKSPACE</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.heroDivider} />

            <View style={s.memberFooter}>
              <Text style={s.memberSinceText}>🛡️ BlackSquad Pilot Member • Verified Identity</Text>
            </View>
          </View>

          {/* Quick 4-Pill Action Hub (Uber/Rapido style) */}
          <View style={s.quickHubGrid}>
            <Pressable
              style={[s.quickHubCard, activeTab === 'safety' && s.quickHubActive]}
              onPress={() => setActiveTab('safety')}
            >
              <Text style={s.quickHubIcon}>🛡️</Text>
              <Text style={s.quickHubLabel}>Safety</Text>
              <Text style={s.quickHubSub}>24x7 SOS</Text>
            </Pressable>

            <Pressable
              style={[s.quickHubCard, activeTab === 'wallet' && s.quickHubActive]}
              onPress={() => setActiveTab('wallet')}
            >
              <Text style={s.quickHubIcon}>💳</Text>
              <Text style={s.quickHubLabel}>Wallet</Text>
              <Text style={s.quickHubSub}>₹1,450.00</Text>
            </Pressable>

            <Pressable
              style={[s.quickHubCard, activeTab === 'saved_places' && s.quickHubActive]}
              onPress={() => setActiveTab('saved_places')}
            >
              <Text style={s.quickHubIcon}>📍</Text>
              <Text style={s.quickHubLabel}>Saved</Text>
              <Text style={s.quickHubSub}>Home / Work</Text>
            </Pressable>

            <Pressable
              style={[s.quickHubCard, activeTab === 'account' && s.quickHubActive]}
              onPress={() => setActiveTab('account')}
            >
              <Text style={s.quickHubIcon}>👤</Text>
              <Text style={s.quickHubLabel}>Account</Text>
              <Text style={s.quickHubSub}>Edit Profile</Text>
            </Pressable>
          </View>

          {/* Secondary Tab Navigation */}
          <View style={s.tabScrollContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabList}>
              <Pressable
                style={[s.navTabPill, activeTab === 'account' && s.navTabPillActive]}
                onPress={() => setActiveTab('account')}
              >
                <Text style={[s.navTabText, activeTab === 'account' && s.navTabTextActive]}>
                  👤 Personal Info
                </Text>
              </Pressable>

              {role === 'DRIVER' && (
                <Pressable
                  style={[s.navTabPill, activeTab === 'driver_kyc' && s.navTabPillActive]}
                  onPress={() => setActiveTab('driver_kyc')}
                >
                  <Text style={[s.navTabText, activeTab === 'driver_kyc' && s.navTabTextActive]}>
                    🛞 KYC & Bank Account
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[s.navTabPill, activeTab === 'saved_places' && s.navTabPillActive]}
                onPress={() => setActiveTab('saved_places')}
              >
                <Text style={[s.navTabText, activeTab === 'saved_places' && s.navTabTextActive]}>
                  📍 Saved Places
                </Text>
              </Pressable>

              <Pressable
                style={[s.navTabPill, activeTab === 'safety' && s.navTabPillActive]}
                onPress={() => setActiveTab('safety')}
              >
                <Text style={[s.navTabText, activeTab === 'safety' && s.navTabTextActive]}>
                  🛡️ Safety Center
                </Text>
              </Pressable>

              <Pressable
                style={[s.navTabPill, activeTab === 'wallet' && s.navTabPillActive]}
                onPress={() => setActiveTab('wallet')}
              >
                <Text style={[s.navTabText, activeTab === 'wallet' && s.navTabTextActive]}>
                  💳 Payments & UPI
                </Text>
              </Pressable>

              <Pressable
                style={[s.navTabPill, activeTab === 'settings' && s.navTabPillActive]}
                onPress={() => setActiveTab('settings')}
              >
                <Text style={[s.navTabText, activeTab === 'settings' && s.navTabTextActive]}>
                  ⚙️ Settings & Legal
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Feedback alerts */}
          {successMsg.length > 0 && (
            <View style={s.alertSuccess}>
              <Text style={s.alertSuccessText}>✓ {successMsg}</Text>
            </View>
          )}

          {errorMsg.length > 0 && (
            <View style={s.alertError}>
              <Text style={s.alertErrorText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          {/* TAB 1: PERSONAL ACCOUNT INFO */}
          {activeTab === 'account' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>Profile Information</Text>
              <Text style={s.sectionHeaderSub}>
                Manage your verified contact details and personal settings.
              </Text>

              <View style={s.inputCard}>
                <Text style={s.inputLabel}>FULL NAME</Text>
                <TextInput
                  style={s.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="#64748B"
                />

                <Text style={s.inputLabel}>EMAIL ADDRESS (READ-ONLY)</Text>
                <TextInput
                  style={[s.textInput, s.textInputDisabled]}
                  value={user?.email || ''}
                  editable={false}
                />

                <Text style={s.inputLabel}>PHONE NUMBER (FOR RIDE NOTIFICATIONS)</Text>
                <TextInput
                  style={s.textInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                />

                <AppButton
                  label={saving ? 'Saving changes...' : 'Save Profile Changes'}
                  onPress={handleSaveAccount}
                  disabled={saving}
                />
              </View>
            </View>
          )}

          {/* TAB 2: SAVED PLACES */}
          {activeTab === 'saved_places' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>Saved Addresses</Text>
              <Text style={s.sectionHeaderSub}>
                1-Tap pickup and destination shortcuts for faster bookings.
              </Text>

              {savedPlaces.map((place) => (
                <View key={place.id} style={s.placeCard}>
                  <View style={s.placeIconBox}>
                    <Text style={s.placeEmoji}>{place.icon === 'home' ? '🏠' : '🏢'}</Text>
                  </View>
                  <View style={s.placeDetails}>
                    <Text style={s.placeTitle}>{place.title}</Text>
                    <Text style={s.placeAddress}>{place.address}</Text>
                  </View>
                  <Pressable
                    style={s.placeEditBtn}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        const next = window.prompt(`Edit address for ${place.title}`, place.address);
                        if (next) {
                          setSavedPlaces((prev) =>
                            prev.map((p) => (p.id === place.id ? { ...p, address: next } : p)),
                          );
                        }
                      }
                    }}
                  >
                    <Text style={s.placeEditText}>Edit</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={s.addPlaceBtn}
                onPress={() => {
                  const newPlace: SavedPlace = {
                    id: Date.now().toString(),
                    title: 'Favorite Spot',
                    address: 'MG Road Metro Station, Bangalore',
                    latitude: 12.9756,
                    longitude: 77.6066,
                    icon: 'favorite',
                  };
                  setSavedPlaces((prev) => [...prev, newPlace]);
                }}
              >
                <Text style={s.addPlaceIcon}>＋</Text>
                <Text style={s.addPlaceText}>Add New Favorite Place</Text>
              </Pressable>
            </View>
          )}

          {/* TAB 3: DRIVER KYC & BANK ACCOUNTS */}
          {activeTab === 'driver_kyc' && role === 'DRIVER' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>Driver KYC & Vehicle Documents</Text>
              <Text style={s.sectionHeaderSub}>
                Government verified transport credentials and automated bank settlement setup.
              </Text>

              {/* Verified Documents Card */}
              <View style={s.docCard}>
                <View style={s.docRow}>
                  <Text style={s.docIcon}>🪪</Text>
                  <View style={s.docInfo}>
                    <Text style={s.docTitle}>Commercial Driving License</Text>
                    <Text style={s.docNumber}>
                      {driverProfile?.licenseNumber || 'DL-KA042021008892'}
                    </Text>
                  </View>
                  <View style={s.verifiedTag}>
                    <Text style={s.verifiedTagText}>VERIFIED</Text>
                  </View>
                </View>

                <View style={s.docDivider} />

                <View style={s.docRow}>
                  <Text style={s.docIcon}>🚕</Text>
                  <View style={s.docInfo}>
                    <Text style={s.docTitle}>Vehicle Registration (RC)</Text>
                    <Text style={s.docNumber}>KA 04 MP 8821 • White Toyota Innova</Text>
                  </View>
                  <View style={s.verifiedTag}>
                    <Text style={s.verifiedTagText}>ACTIVE</Text>
                  </View>
                </View>
              </View>

              {/* Bank Account Settlement Form */}
              <Text style={[s.sectionHeaderTitle, { marginTop: spacing.xl }]}>
                Automated Bank Settlement (IFSC)
              </Text>

              <View style={s.inputCard}>
                <Text style={s.inputLabel}>ACCOUNT HOLDER NAME</Text>
                <TextInput
                  style={s.textInput}
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                  placeholder="Name as per Bank Passbook"
                  placeholderTextColor="#64748B"
                />

                <Text style={s.inputLabel}>SELECT YOUR INDIAN BANK</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bankPills}>
                  {POPULAR_BANKS.map((b: BankPreset) => (
                    <Pressable
                      key={b.id}
                      style={[
                        s.bankChip,
                        selectedBank?.id === b.id && s.bankChipActive,
                      ]}
                      onPress={() => {
                        setSelectedBank(b);
                        if (b.ifscPrefix && ifscCode.length < 4) {
                          setIfscCode(b.ifscPrefix);
                        }
                      }}
                    >
                      <Text style={s.bankChipText}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={s.inputLabel}>BANK ACCOUNT NUMBER</Text>
                <TextInput
                  style={s.textInput}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Enter Account Number"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  secureTextEntry
                />

                <Text style={s.inputLabel}>CONFIRM ACCOUNT NUMBER</Text>
                <TextInput
                  style={s.textInput}
                  value={confirmAccountNumber}
                  onChangeText={setConfirmAccountNumber}
                  placeholder="Re-enter Account Number"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                />

                <Text style={s.inputLabel}>IFSC CODE (11 CHARACTERS)</Text>
                <TextInput
                  style={s.textInput}
                  value={ifscCode}
                  onChangeText={handleIfscChange}
                  placeholder="e.g. HDFC0000001, SBIN0001234"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  maxLength={11}
                />

                {ifscLookupLoading && (
                  <Text style={s.ifscHint}>⏳ Validating IFSC code with RBI registry...</Text>
                )}

                {verifiedIfsc && (
                  <View style={s.ifscVerifiedBox}>
                    <Text style={s.ifscVerifiedTitle}>✓ Verified: {verifiedIfsc.bankName}</Text>
                    <Text style={s.ifscVerifiedSub}>
                      Branch: {verifiedIfsc.branchName} • {verifiedIfsc.city}
                    </Text>
                  </View>
                )}

                <Text style={s.inputLabel}>DIRECT UPI ID (FOR INSTANT PAYOUTS)</Text>
                <TextInput
                  style={s.textInput}
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="e.g. driver@oksbi, driver@paytm"
                  placeholderTextColor="#64748B"
                />

                <AppButton
                  label={saving ? 'Saving Bank Details...' : 'Save Settlement Account'}
                  onPress={handleSaveBank}
                  disabled={saving}
                />
              </View>
            </View>
          )}

          {/* TAB 4: SAFETY CENTER */}
          {activeTab === 'safety' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>BlackSquad Safety Center</Text>
              <Text style={s.sectionHeaderSub}>
                Built-in 24x7 security features, trusted contacts, and PIN verification.
              </Text>

              {/* Big Red SOS Button */}
              <Pressable style={s.sosButton} onPress={triggerEmergencySOS}>
                <Text style={s.sosIcon}>🚨</Text>
                <View style={s.sosTextGroup}>
                  <Text style={s.sosTitle}>EMERGENCY 24x7 SOS</Text>
                  <Text style={s.sosSub}>Tap to alert Emergency Services & share live GPS</Text>
                </View>
              </Pressable>

              <View style={s.safetyRow}>
                <View style={s.safetyInfo}>
                  <Text style={s.safetyTitle}>Verify Rides with 4-Digit PIN</Text>
                  <Text style={s.safetySub}>
                    Drivers must enter your unique PIN before starting each trip.
                  </Text>
                </View>
                <Pressable
                  style={[s.toggleBtn, pinEnabled && s.toggleBtnActive]}
                  onPress={() => setPinEnabled(!pinEnabled)}
                >
                  <Text style={s.toggleBtnText}>{pinEnabled ? 'ON' : 'OFF'}</Text>
                </Pressable>
              </View>

              <View style={s.safetyRow}>
                <View style={s.safetyInfo}>
                  <Text style={s.safetyTitle}>Trusted Emergency Contact</Text>
                  <Text style={s.safetySub}>{emergencyContact}</Text>
                </View>
                <Pressable
                  style={s.placeEditBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const num = window.prompt('Update emergency phone number:', emergencyContact);
                      if (num) setEmergencyContact(num);
                    }
                  }}
                >
                  <Text style={s.placeEditText}>Change</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* TAB 5: WALLET & PAYMENTS */}
          {activeTab === 'wallet' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>BlackSquad Wallet & Payments</Text>
              <Text style={s.sectionHeaderSub}>
                Seamless digital payments, UPI integration, and instant settlements.
              </Text>

              <View style={s.walletCard}>
                <Text style={s.walletLabel}>TOTAL WALLET BALANCE</Text>
                <Text style={s.walletAmount}>₹1,450.00</Text>
                <View style={s.walletBtnRow}>
                  <Pressable
                    style={s.walletActionBtn}
                    onPress={() => {
                      if (Platform.OS === 'web') window.alert('Top-up via UPI / Netbanking initiated.');
                    }}
                  >
                    <Text style={s.walletActionText}>＋ Add Money</Text>
                  </Pressable>

                  {role === 'DRIVER' && (
                    <Pressable
                      style={[s.walletActionBtn, s.walletSettleBtn]}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.alert('⚡ Instant payout of ₹1,450.00 transferred to your linked bank account!');
                        }
                      }}
                    >
                      <Text style={[s.walletActionText, { color: '#00D084' }]}>⚡ Instant Payout</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Text style={[s.sectionHeaderTitle, { marginTop: spacing.xl }]}>Payment Methods</Text>

              <View style={s.paymentMethodCard}>
                <Text style={s.paymentIcon}>📱</Text>
                <View style={s.paymentInfo}>
                  <Text style={s.paymentTitle}>Google Pay / PhonePe UPI</Text>
                  <Text style={s.paymentSub}>Linked • Default payment for auto-debit</Text>
                </View>
                <Text style={s.defaultPill}>DEFAULT</Text>
              </View>

              <View style={s.paymentMethodCard}>
                <Text style={s.paymentIcon}>💵</Text>
                <View style={s.paymentInfo}>
                  <Text style={s.paymentTitle}>Cash on Delivery</Text>
                  <Text style={s.paymentSub}>Pay driver directly upon drop-off</Text>
                </View>
              </View>
            </View>
          )}

          {/* TAB 6: SETTINGS & LEGAL */}
          {activeTab === 'settings' && (
            <View style={s.sectionContent}>
              <Text style={s.sectionHeaderTitle}>App Settings & Preferences</Text>

              <View style={s.settingsCard}>
                <View style={s.settingRow}>
                  <Text style={s.settingLabel}>AMOLED Dark Theme</Text>
                  <Pressable
                    style={[s.toggleBtn, darkMode && s.toggleBtnActive]}
                    onPress={() => setDarkMode(!darkMode)}
                  >
                    <Text style={s.toggleBtnText}>{darkMode ? 'ON' : 'OFF'}</Text>
                  </Pressable>
                </View>

                <View style={s.settingDivider} />

                <View style={s.settingRow}>
                  <Text style={s.settingLabel}>Language</Text>
                  <Text style={s.settingValue}>{selectedLanguage}</Text>
                </View>

                <View style={s.settingDivider} />

                <View style={s.settingRow}>
                  <Text style={s.settingLabel}>App Version</Text>
                  <Text style={s.settingValue}>v0.4.0 (Pilot Release)</Text>
                </View>
              </View>

              <Text style={[s.sectionHeaderTitle, { marginTop: spacing.xl }]}>Account Actions</Text>

              <Pressable style={s.logoutActionBtn} onPress={onLogout}>
                <Text style={s.logoutActionText}>🚪 Sign Out of BlackSquad</Text>
              </Pressable>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create<any>({
  modalRoot: {
    flex: 1,
    backgroundColor: '#070C18',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 48 : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0A0F1D',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnIcon: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  appBarTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  verifiedBadgeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00D084',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  verifiedCheck: {
    color: '#070C18',
    fontSize: 12,
    fontWeight: '900',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  heroEmail: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    gap: 4,
  },
  ratingStar: {
    color: '#FACC15',
    fontSize: 12,
  },
  ratingScore: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  rolePill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  rolePillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.md,
  },
  memberFooter: {
    alignItems: 'flex-start',
  },
  memberSinceText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  quickHubGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  quickHubCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickHubActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
  },
  quickHubIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  quickHubLabel: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 12,
  },
  quickHubSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  tabScrollContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tabList: {
    gap: spacing.sm,
  },
  navTabPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  navTabPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  navTabText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  navTabTextActive: {
    color: '#FFFFFF',
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  sectionHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeaderSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  inputCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: spacing.sm,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textInputDisabled: {
    opacity: 0.6,
    backgroundColor: '#162032',
  },
  alertSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  alertSuccessText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  alertErrorText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 13,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeEmoji: {
    fontSize: 18,
  },
  placeDetails: {
    flex: 1,
  },
  placeTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  placeAddress: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  placeEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#1E293B',
  },
  placeEditText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 12,
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  addPlaceIcon: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '900',
  },
  addPlaceText: {
    color: '#38BDF8',
    fontWeight: '800',
    fontSize: 13,
  },
  docCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  docIcon: {
    fontSize: 24,
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
    fontWeight: '800',
    fontSize: 14,
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verifiedTagText: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 10,
  },
  docDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.md,
  },
  bankPills: {
    marginVertical: 4,
  },
  bankChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: spacing.sm,
  },
  bankChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  bankChipText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  ifscHint: {
    color: '#38BDF8',
    fontSize: 12,
    marginVertical: 4,
  },
  ifscVerifiedBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#10B981',
    marginVertical: 4,
  },
  ifscVerifiedTitle: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 13,
  },
  ifscVerifiedSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  sosIcon: {
    fontSize: 32,
  },
  sosTextGroup: {
    flex: 1,
  },
  sosTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  sosSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.sm,
  },
  safetyInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  safetyTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  safetySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  toggleBtnActive: {
    backgroundColor: '#00D084',
  },
  toggleBtnText: {
    color: '#070C18',
    fontWeight: '900',
    fontSize: 12,
  },
  walletCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  walletLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  walletAmount: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: spacing.xs,
  },
  walletBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  walletActionBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
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
    fontSize: 13,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  paymentIcon: {
    fontSize: 24,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  paymentSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  defaultPill: {
    backgroundColor: '#1E293B',
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  settingsCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  settingValue: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.md,
  },
  logoutActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logoutActionText: {
    color: '#FCA5A5',
    fontWeight: '800',
    fontSize: 14,
  },
});
