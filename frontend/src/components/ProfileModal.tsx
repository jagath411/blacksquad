import React, { useState, useEffect } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { Input } from './ui';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';
import type { UserRole } from '../types';
import { getCurrentUser, updateUserProfile, type UserProfile } from '../services/authService';
import { getDriverProfile, updateDriverProfile, type BankDetails } from '../services/driverService';
import { ALL_INDIAN_BANKS, searchIndianBanks, findBankByCodeOrName, type IndianBankData } from '../utils/allIndianBanks';
import { lookupIfscCode, isValidIfscFormat, type VerifiedIfscResult } from '../services/ifscService';

interface ProfileModalProps {
  visible: boolean;
  role: UserRole;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileModal({ visible, role, onClose, onLogout }: ProfileModalProps) {
  const [tab, setTab] = useState<'profile' | 'bank' | 'settings'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Profile Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Bank Fields
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankLogoUrl, setBankLogoUrl] = useState('');

  // Indian Bank Search & IFSC Verification State
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [verifiedIfsc, setVerifiedIfsc] = useState<VerifiedIfscResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMessage('');
    setError('');
    setLoading(true);

    Promise.all([
      getCurrentUser().catch(() => null),
      role === 'DRIVER' ? getDriverProfile().catch(() => null) : Promise.resolve(null),
    ])
      .then(([user, driver]) => {
        if (user) {
          setName(user.name || '');
          setEmail(user.email || '');
          setPhoneNumber(user.phoneNumber || '');
        }
        if (driver?.bankDetails) {
          setAccountHolder(driver.bankDetails.accountHolderName || '');
          setBankName(driver.bankDetails.bankName || '');
          setAccountNumber(driver.bankDetails.accountNumber || '');
          setIfscCode(driver.bankDetails.ifscCode || '');
          setBranchName(driver.bankDetails.branchName || '');
          setUpiId(driver.bankDetails.upiId || '');

          const matched = findBankByCodeOrName(driver.bankDetails.bankName || '');
          if (matched?.logoUrl) setBankLogoUrl(matched.logoUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [visible, role]);

  const handleSelectIndianBank = (bank: IndianBankData) => {
    setBankName(bank.name);
    setBankLogoUrl(bank.logoUrl);
    setShowBankDropdown(false);
    setBankSearchQuery('');
    if (!ifscCode) setIfscCode(bank.sampleIfsc);
    if (!branchName) setBranchName(bank.defaultBranch);
    if (!upiId && email) {
      const handle = email.split('@')[0];
      setUpiId(`${handle}${bank.upiHandles[0] || '@upi'}`);
    }
  };

  const handleIfscChange = async (val: string) => {
    const formatted = val.toUpperCase().trim();
    setIfscCode(formatted);

    if (isValidIfscFormat(formatted)) {
      setIfscLoading(true);
      const res = await lookupIfscCode(formatted);
      setIfscLoading(false);
      if (res) {
        setVerifiedIfsc(res);
        setBankName(res.bankName);
        setBranchName(res.branchName);
        if (res.logoUrl) setBankLogoUrl(res.logoUrl);
      }
    } else {
      setVerifiedIfsc(null);
    }
  };

  const matchedBankMeta = findBankByCodeOrName(bankName);
  const activeLogoUrl = bankLogoUrl || matchedBankMeta?.logoUrl;
  const activeColor = matchedBankMeta?.brandColor || '#2563EB';

  const filteredBanks = searchIndianBanks(bankSearchQuery);

  const handleSave = async () => {
    setError('');
    setMessage('');
    setSaving(true);

    try {
      await updateUserProfile({ name, phoneNumber });

      if (role === 'DRIVER') {
        const bankData: BankDetails = {
          accountHolderName: accountHolder,
          bankName,
          accountNumber,
          ifscCode,
          branchName,
          upiId,
        };
        await updateDriverProfile({ bankDetails: bankData });
      }

      setMessage('Profile & Bank details updated successfully!');
      setTimeout(() => setMessage(''), 4000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name ? name.slice(0, 2).toUpperCase() : 'US'}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{name || 'User Profile'}</Text>
                  <Text style={styles.userEmail}>{email}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{role} ACCOUNT</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Tab Controls */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabItem, tab === 'profile' && styles.activeTabItem]}
                onPress={() => setTab('profile')}
              >
                <Text style={[styles.tabText, tab === 'profile' && styles.activeTabText]}>Personal Info</Text>
              </Pressable>

              {(role === 'DRIVER' || role === 'OWNER') && (
                <Pressable
                  style={[styles.tabItem, tab === 'bank' && styles.activeTabItem]}
                  onPress={() => setTab('bank')}
                >
                  <Text style={[styles.tabText, tab === 'bank' && styles.activeTabText]}>Bank Payouts</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.tabItem, tab === 'settings' && styles.activeTabItem]}
                onPress={() => setTab('settings')}
              >
                <Text style={[styles.tabText, tab === 'settings' && styles.activeTabText]}>Settings</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} nestedScrollEnabled>
            {message ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ {message}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            {loading ? (
              <Text style={styles.loadingText}>Loading profile details...</Text>
            ) : tab === 'profile' ? (
              <View style={styles.formGroup}>
                <Input
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  tone="dark"
                />
                <Input
                  label="Email Address (Registered)"
                  value={email}
                  onChangeText={() => {}}
                  editable={false}
                  tone="dark"
                />
                <Input
                  label="Phone Number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+1 (555) 000-0000"
                  keyboardType="phone-pad"
                  tone="dark"
                />
              </View>
            ) : tab === 'bank' ? (
              <View style={styles.formGroup}>
                <Text style={styles.sectionHeading}>🇮🇳 All Indian Banks Payout Setup</Text>
                <Text style={styles.sectionSub}>Search any Indian bank or enter IFSC to auto-verify branch & logo via RBI/Razorpay API.</Text>

                {/* Popular Bank Selector Chips */}
                <Text style={styles.fieldLabel}>Select Popular Indian Bank</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankChipsScroll}>
                  {ALL_INDIAN_BANKS.slice(0, 12).map((b) => {
                    const selected = bankName === b.name;
                    return (
                      <Pressable
                        key={b.code}
                        style={[styles.bankChip, selected && { borderColor: b.brandColor, backgroundColor: `${b.brandColor}25` }]}
                        onPress={() => handleSelectIndianBank(b)}
                      >
                        {b.logoUrl ? (
                          <Image source={{ uri: b.logoUrl }} style={styles.bankChipImage} resizeMode="contain" />
                        ) : (
                          <Text style={styles.bankChipIcon}>{b.logoEmoji}</Text>
                        )}
                        <Text style={[styles.bankChipName, selected && { color: b.brandColor }]}>{b.shortName}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Search All Indian Banks Input */}
                <View style={{ zIndex: 10 }}>
                  <Input
                    label="Search Any Indian Bank (100+ Banks)"
                    value={bankName || bankSearchQuery}
                    onChangeText={(q) => {
                      setBankSearchQuery(q);
                      setBankName(q);
                      setShowBankDropdown(true);
                    }}
                    onFocus={() => setShowBankDropdown(true)}
                    placeholder="Type bank name (e.g. Canara, SBI, Federal, HDFC...)"
                    tone="dark"
                  />

                  {showBankDropdown && (
                    <View style={styles.bankDropdown}>
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                        {filteredBanks.map((item) => (
                          <Pressable
                            key={item.code}
                            style={styles.dropdownItem}
                            onPress={() => handleSelectIndianBank(item)}
                          >
                            <View style={[styles.dropdownBadge, { backgroundColor: item.brandColor }]}>
                              <Text style={{ fontSize: 14 }}>{item.logoEmoji}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.dropdownBankName}>{item.name}</Text>
                              <Text style={styles.dropdownBankCode}>IFSC Code Prefix: {item.code}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Real Logo UPI Style Live Card */}
                {bankName ? (
                  <View style={[styles.upiCard, { borderColor: activeColor }]}>
                    <View style={styles.upiCardHeader}>
                      <View style={[styles.bankBadge, { backgroundColor: activeColor }]}>
                        {activeLogoUrl ? (
                          <Image source={{ uri: activeLogoUrl }} style={styles.bankBadgeImage} resizeMode="contain" />
                        ) : (
                          <Text style={styles.bankBadgeText}>{matchedBankMeta?.logoEmoji || '🏦'}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upiBankTitle}>{bankName}</Text>
                        <Text style={styles.upiBranchText}>{branchName || matchedBankMeta?.defaultBranch || 'Branch Setup'}</Text>
                      </View>
                      <Text style={styles.verifiedBadge}>✓ Real Bank Logo</Text>
                    </View>
                    <View style={styles.upiCardDivider} />
                    <View style={styles.upiCardRow}>
                      <Text style={styles.upiLabel}>IFSC Code:</Text>
                      <Text style={styles.upiValue}>{ifscCode || matchedBankMeta?.sampleIfsc || 'N/A'}</Text>
                    </View>
                    {verifiedIfsc?.address ? (
                      <View style={styles.upiCardRow}>
                        <Text style={styles.upiLabel}>Branch Address:</Text>
                        <Text style={[styles.upiValue, { fontSize: 11, flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                          {verifiedIfsc.address}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Input
                  label="Account Holder Name"
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                  placeholder="Name as in bank account"
                  tone="dark"
                />

                <View>
                  <Input
                    label="IFSC Code (Auto-Verifies via Razorpay API)"
                    value={ifscCode}
                    onChangeText={handleIfscChange}
                    placeholder="e.g. CNRB0001002 or SBIN0000840"
                    autoCapitalize="characters"
                    maxLength={11}
                    tone="dark"
                  />
                  {ifscLoading && <Text style={styles.ifscHintLoading}>⚡ Validating IFSC with Razorpay/RBI Database...</Text>}
                  {verifiedIfsc && (
                    <Text style={styles.ifscHintSuccess}>
                      ✓ Verified Branch: {verifiedIfsc.branchName} ({verifiedIfsc.city}, {verifiedIfsc.state})
                    </Text>
                  )}
                </View>

                <Input
                  label="Branch Name & Address"
                  value={branchName}
                  onChangeText={setBranchName}
                  placeholder="e.g. Bodinayakanur Branch, Tamil Nadu"
                  tone="dark"
                />

                <Input
                  label="Account Number"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="e.g. 987654321012"
                  keyboardType="number-pad"
                  tone="dark"
                />

                <Input
                  label="UPI ID / Direct Pay Handle"
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="name@oksbi / name@paytm / GPay handle"
                  tone="dark"
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.sectionHeading}>Account Preferences</Text>
                <View style={styles.prefRow}>
                  <Text style={styles.prefTitle}>Push Notifications</Text>
                  <Text style={styles.prefValue}>Enabled</Text>
                </View>
                <View style={styles.prefRow}>
                  <Text style={styles.prefTitle}>Live GPS High-Accuracy</Text>
                  <Text style={styles.prefValue}>Active</Text>
                </View>
                <View style={styles.prefRow}>
                  <Text style={styles.prefTitle}>Map Renderer</Text>
                  <Text style={styles.prefValue}>MapLibre GL Vector</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label={saving ? 'Saving changes...' : 'Save Profile Details'}
              loading={saving}
              disabled={saving || loading}
              onPress={handleSave}
            />
            <Pressable style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>Log Out of Account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 13, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    minHeight: '65%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    marginTop: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: spacing.md,
  },
  tabItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#38BDF8',
  },
  tabText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
  activeTabText: {
    color: '#38BDF8',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  formGroup: {
    gap: spacing.md,
  },
  sectionHeading: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  successBox: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  successText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#451A1A',
    borderColor: '#F87171',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  loadingText: {
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  prefTitle: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  prefValue: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  bankChipsScroll: {
    marginVertical: 4,
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    marginRight: spacing.sm,
    gap: 6,
  },
  bankChipIcon: {
    fontSize: 16,
  },
  bankChipName: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  upiCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  upiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bankBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBadgeText: {
    fontSize: 20,
  },
  upiBankTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 15,
  },
  upiBranchText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  verifiedBadge: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 11,
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upiCardDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  upiCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upiLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  upiValue: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  bankChipImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  bankDropdown: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: 4,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: spacing.sm,
  },
  dropdownBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBankName: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  dropdownBankCode: {
    color: '#94A3B8',
    fontSize: 10,
  },
  bankBadgeImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  ifscHintLoading: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  ifscHintSuccess: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: spacing.sm,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
});
