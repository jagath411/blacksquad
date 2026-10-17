import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Constants from 'expo-constants';
import { AppButton } from './AppButton';
import { Icon } from './ui/Icon';
import type { UserRole } from '../types';
import {
  deleteAccount,
  getCurrentUser,
  updateUserProfile,
  type SavedPlace,
  type UserProfile,
} from '../services/authService';
import { getDriverProfile, updateDriverProfile, type BankDetails } from '../services/driverService';
import { geocodeAddress } from '../services/geocodingService';
import { lookupIfscCode, type VerifiedIfscResult } from '../services/ifscService';
import { callNumber, confirmAction } from '../utils/dialogs';
import { formatUnifiedError } from '../utils/errorHandler';
import { fonts } from '../theme/fonts';
import { go, ink, line, paper, stop, subtle, surface, text2, text3 } from '../theme/palette';

interface Props {
  visible: boolean;
  role: UserRole;
  onClose: () => void;
  onLogout: () => void;
}

type Section = 'account' | 'places' | 'payout' | 'safety' | 'app';

const ROLE_NAMES: Record<UserRole, string> = { CUSTOMER: 'Rider', DRIVER: 'Driver', OWNER: 'Fleet owner' };

function showError(cause: unknown) {
  const err = formatUnifiedError(cause);
  if (Platform.OS === 'web') window.alert(`${err.title}\n\n${err.message}`);
  else Alert.alert(err.title, err.message);
}

/** Account, saved places, payout details, safety and app settings for the signed-in user. */
export function ProfileModal({ visible, role, onClose, onLogout }: Props) {
  const sections: { id: Section; label: string }[] = [
    { id: 'account', label: 'Account' },
    ...(role === 'CUSTOMER' ? [{ id: 'places' as const, label: 'Saved places' }] : []),
    ...(role === 'DRIVER' ? [{ id: 'payout' as const, label: 'Payout details' }] : []),
    ...(role !== 'OWNER' ? [{ id: 'safety' as const, label: 'Safety' }] : []),
    { id: 'app', label: 'App' },
  ];
  const [section, setSection] = useState<Section>('account');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!visible) return;
    setNotice('');
    getCurrentUser().then(setUser).catch(() => undefined);
  }, [visible]);

  const saved = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {user?.name || ' '}
              </Text>
              <Text style={s.roleLine}>{ROLE_NAMES[role]}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" style={s.closeBtn} onPress={onClose}>
              <Icon name="close" size={22} color={ink} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabs}>
            {sections.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: section === item.id }}
                onPress={() => setSection(item.id)}
                style={[s.tab, section === item.id && s.tabActive]}
              >
                <Text style={[s.tabText, section === item.id && s.tabTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {notice ? (
            <View style={s.notice} accessibilityRole="alert">
              <Icon name="checkmark-circle" size={18} color={go} />
              <Text style={s.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {section === 'account' && user && <AccountSection user={user} onSaved={(u) => { setUser(u); saved('Account saved'); }} />}
            {section === 'places' && user && <PlacesSection user={user} onSaved={(u) => { setUser(u); saved('Saved places updated'); }} />}
            {section === 'payout' && <PayoutSection onSaved={() => saved('Payout details saved')} />}
            {section === 'safety' && user && <SafetySection user={user} onSaved={(u) => { setUser(u); saved('Emergency contact saved'); }} />}
            {section === 'app' && <AppSection onClose={onClose} onLogout={onLogout} />}
            {!user && section !== 'app' && section !== 'payout' ? <ActivityIndicator color={ink} style={{ marginTop: 24 }} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  const { label, hint, style, ...rest } = props;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={text3} style={[s.input, style]} accessibilityLabel={label} {...rest} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function AccountSection({ user, onSaved }: { user: UserProfile; onSaved: (u: UserProfile) => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await updateUserProfile({ name: name.trim(), ...(phone.trim() ? { phoneNumber: phone.trim() } : {}) }));
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {user.email && !user.email.endsWith('@blacksquad.internal') ? (
        <Field label="Email" value={user.email} editable={false} style={{ color: text2 }} />
      ) : null}
      <AppButton label="Save changes" loading={busy} disabled={name.trim().length < 2} onPress={() => void save()} />
    </View>
  );
}

function PlacesSection({ user, onSaved }: { user: UserProfile; onSaved: (u: UserProfile) => void }) {
  const places = user.savedPlaces ?? [];
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const store = async (next: SavedPlace[]) => {
    setBusy(true);
    try {
      onSaved(await updateUserProfile({ savedPlaces: next }));
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const found = await geocodeAddress(address.trim());
      if (!found) {
        showError(new Error(`We couldn't find "${address.trim()}". Try a fuller address.`));
        return;
      }
      await store([...places, { label: label.trim(), address: address.trim(), coordinates: [found.longitude, found.latitude] }]);
      setLabel('');
      setAddress('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={s.lead}>Places you save show up when you book, so you can pick them in one tap.</Text>
      {places.length === 0 ? <Text style={s.empty}>No saved places yet.</Text> : null}
      {places.map((place, index) => (
        <View key={`${place.label}-${index}`} style={s.row}>
          <Icon name={place.label.toLowerCase() === 'home' ? 'home' : place.label.toLowerCase() === 'work' ? 'briefcase' : 'location'} size={20} color={ink} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{place.label}</Text>
            <Text style={s.rowSub} numberOfLines={2}>
              {place.address}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${place.label}`}
            hitSlop={8}
            onPress={() => void store(places.filter((_, i) => i !== index))}
          >
            <Icon name="trash-outline" size={20} color={stop} />
          </Pressable>
        </View>
      ))}
      {places.length < 10 ? (
        <View style={s.addBox}>
          <Field label="Name" value={label} onChangeText={setLabel} placeholder="Home, Work, Gym…" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, area, city" />
          <AppButton
            label="Add place"
            variant="secondary"
            loading={busy}
            disabled={!label.trim() || address.trim().length < 3}
            onPress={() => void add()}
          />
        </View>
      ) : null}
    </View>
  );
}

function PayoutSection({ onSaved }: { onSaved: () => void }) {
  const [details, setDetails] = useState<BankDetails>({});
  const [licence, setLicence] = useState('');
  const [bank, setBank] = useState<VerifiedIfscResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDriverProfile()
      .then((profile) => {
        setDetails(profile.bankDetails ?? {});
        setLicence(profile.licenseNumber ?? '');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof BankDetails) => (value: string) => setDetails((d) => ({ ...d, [key]: value }));

  const onIfsc = async (value: string) => {
    const code = value.toUpperCase();
    set('ifscCode')(code);
    setBank(null);
    if (code.length === 11) {
      const found = await lookupIfscCode(code).catch(() => null);
      setBank(found);
      if (found) setDetails((d) => ({ ...d, ifscCode: code, bankName: found.bankName, branchName: found.branchName }));
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateDriverProfile({ bankDetails: details, ...(licence.trim().length >= 3 ? { licenseNumber: licence.trim() } : {}) });
      onSaved();
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator color={ink} style={{ marginTop: 24 }} />;
  return (
    <View>
      <Text style={s.lead}>Your fleet owner pays your earnings to this account. Only you and your fleet owner can see it.</Text>
      <Field label="Account holder name" value={details.accountHolderName ?? ''} onChangeText={set('accountHolderName')} autoCapitalize="words" />
      <Field label="Account number" value={details.accountNumber ?? ''} onChangeText={set('accountNumber')} keyboardType="number-pad" />
      <Field
        label="IFSC"
        value={details.ifscCode ?? ''}
        onChangeText={(v) => void onIfsc(v)}
        autoCapitalize="characters"
        maxLength={11}
        hint={bank ? `${bank.bankName}, ${bank.branchName}` : details.ifscCode?.length === 11 ? 'IFSC not found' : '11 characters, e.g. HDFC0001234'}
      />
      <Field label="UPI ID (optional)" value={details.upiId ?? ''} onChangeText={set('upiId')} autoCapitalize="none" placeholder="name@bank" />
      <Field label="Driving licence number" value={licence} onChangeText={setLicence} autoCapitalize="characters" />
      <AppButton label="Save payout details" loading={busy} onPress={() => void save()} />
    </View>
  );
}

function SafetySection({ user, onSaved }: { user: UserProfile; onSaved: (u: UserProfile) => void }) {
  const [name, setName] = useState(user.emergencyContact?.name ?? '');
  const [phone, setPhone] = useState(user.emergencyContact?.phoneNumber ?? '');
  const [busy, setBusy] = useState(false);
  const save = async (clear = false) => {
    setBusy(true);
    try {
      onSaved(await updateUserProfile({ emergencyContact: clear ? null : { name: name.trim() || undefined, phoneNumber: phone.trim() } }));
      if (clear) {
        setName('');
        setPhone('');
      }
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Pressable accessibilityRole="button" style={s.emergency} onPress={() => callNumber('112')}>
        <Icon name="call" size={22} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={s.emergencyTitle}>Call 112</Text>
          <Text style={s.emergencySub}>India&apos;s emergency number for police, fire and ambulance</Text>
        </View>
      </Pressable>

      <Text style={s.subhead}>Emergency contact</Text>
      <Text style={s.lead}>Someone you trust. During a trip you can share your trip with them from the trip screen.</Text>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <AppButton label="Save contact" loading={busy} disabled={phone.trim().length < 8} onPress={() => void save()} />
      {user.emergencyContact ? (
        <Pressable accessibilityRole="button" onPress={() => void save(true)} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={[s.rowSub, { color: stop }]}>Remove contact</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AppSection({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const handleDelete = async () => {
    const ok = await confirmAction(
      'Delete your account?',
      'Your name, phone number, saved places and payment details are removed and you are signed out. This cannot be undone.',
      'Delete',
    );
    if (!ok) return;
    try {
      await deleteAccount();
      onClose();
      onLogout();
    } catch (cause) {
      showError(cause);
    }
  };
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.rowTitle, { flex: 1 }]}>Version</Text>
        <Text style={s.rowSub}>{Constants.expoConfig?.version ?? 'unknown'}</Text>
      </View>
      <View style={{ height: 16 }} />
      <AppButton
        label="Sign out"
        variant="secondary"
        onPress={() => {
          onClose();
          onLogout();
        }}
      />
      <Pressable accessibilityRole="button" onPress={() => void handleDelete()} style={{ marginTop: 20, alignItems: 'center' }}>
        <Text style={[s.rowSub, { color: stop, fontFamily: fonts.w600 }]}>Delete my account</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create<{
  overlay: ViewStyle;
  sheet: ViewStyle;
  header: ViewStyle;
  name: TextStyle;
  roleLine: TextStyle;
  closeBtn: ViewStyle;
  tabs: ViewStyle;
  tab: ViewStyle;
  tabActive: ViewStyle;
  tabText: TextStyle;
  tabTextActive: TextStyle;
  notice: ViewStyle;
  noticeText: TextStyle;
  body: ViewStyle;
  field: ViewStyle;
  fieldLabel: TextStyle;
  input: TextStyle;
  hint: TextStyle;
  lead: TextStyle;
  empty: TextStyle;
  subhead: TextStyle;
  row: ViewStyle;
  rowTitle: TextStyle;
  rowSub: TextStyle;
  addBox: ViewStyle;
  emergency: ViewStyle;
  emergencyTitle: TextStyle;
  emergencySub: TextStyle;
}>({
  overlay: { flex: 1, backgroundColor: 'rgba(29, 35, 43, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 20,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20 },
  name: { fontFamily: fonts.w700, fontSize: 28, color: ink, letterSpacing: -0.4 },
  roleLine: { fontFamily: fonts.w500, fontSize: 16, color: text2, marginTop: 2 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: surface, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 8, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: surface, borderWidth: 1, borderColor: line },
  tabActive: { backgroundColor: ink, borderColor: ink },
  tabText: { fontFamily: fonts.w600, fontSize: 15, color: ink },
  tabTextActive: { color: '#FFFFFF' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E3F2EA',
  },
  noticeText: { fontFamily: fonts.w600, fontSize: 15, color: ink },
  body: { flex: 1, paddingHorizontal: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontFamily: fonts.w600, fontSize: 14, color: ink, marginBottom: 6 },
  input: {
    fontFamily: fonts.w500,
    fontSize: 17,
    color: ink,
    backgroundColor: surface,
    borderWidth: 1,
    borderColor: '#9AA4B0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  hint: { fontFamily: fonts.w400, fontSize: 14, color: text2, marginTop: 6 },
  lead: { fontFamily: fonts.w400, fontSize: 15, lineHeight: 22, color: text2, marginBottom: 16 },
  empty: { fontFamily: fonts.w500, fontSize: 15, color: text3, marginBottom: 16 },
  subhead: { fontFamily: fonts.w700, fontSize: 19, color: ink, marginTop: 24, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: line,
  },
  rowTitle: { fontFamily: fonts.w600, fontSize: 17, color: ink },
  rowSub: { fontFamily: fonts.w400, fontSize: 15, color: text2, marginTop: 2 },
  addBox: { marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: subtle },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: stop,
    borderRadius: 16,
    padding: 18,
  },
  emergencyTitle: { fontFamily: fonts.w700, fontSize: 20, color: '#FFFFFF' },
  emergencySub: { fontFamily: fonts.w400, fontSize: 14, color: '#FFFFFF', marginTop: 2, opacity: 0.92 },
});

