import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from './AppButton';
import { Icon } from './ui/Icon';
import { radius, spacing } from '../theme';
import type { FleetDriver } from '../hooks/useFleet';
import { ALL_INDIAN_BANKS, type IndianBankData } from '../utils/allIndianBanks';

interface Props {
  visible: boolean;
  driver: FleetDriver | null;
  onClose: () => void;
}

export function DriverDetailModal({ visible, driver, onClose }: Props) {
  const [settling, setSettling] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  if (!driver) return null;

  const isOnline = driver.connection === 'online';
  const matchedIndianBank = ALL_INDIAN_BANKS[0];

  const handleSettlePayout = async () => {
    setSettling(true);
    setPayoutSuccess(false);
    try {
      if (Platform.OS === 'web') window.alert('Settlement of ₹4,500.00 initiated via IMPS.');
      setPayoutSuccess(true);
    } catch {
      if (Platform.OS === 'web') window.alert('Settlement failed. Please try again.');
    } finally {
      setSettling(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.driverInfo}>
                <View style={[styles.avatar, { backgroundColor: isOnline ? '#064E3B' : '#1E293B' }]}>
                  <Icon name="person" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.driverTextGroup}>
                  <Text style={styles.driverName}>{driver.driverName || 'Driver Partner'}</Text>
                  <View style={styles.statusBadge}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isOnline ? '#00D084' : '#EF4444' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isOnline ? '#00D084' : '#EF4444' },
                      ]}
                    >
                      {isOnline ? 'Online • Broadcasting GPS' : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Icon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Telemetry Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>VEHICLE & TELEMETRY</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Driver ID</Text>
                <Text style={styles.value}>{driver.driverId.slice(-8)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Speed</Text>
                <Text style={styles.value}>
                  {driver.speed ? `${Math.round(driver.speed)} km/h` : 'Stationary'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Heading</Text>
                <Text style={styles.value}>{driver.heading ? `${Math.round(driver.heading)}°` : '0° North'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Coordinates</Text>
                <Text style={styles.value}>
                  {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                </Text>
              </View>
            </View>

            {/* Bank Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>BANKING & PAYOUT SETTLEMENT</Text>

              {payoutSuccess && (
                <View style={styles.successBox}>
                  <Icon name="checkmark-circle" size={16} color="#34D399" />
                  <Text style={styles.successText}>₹4,500.00 settled instantly via NEFT/IMPS</Text>
                </View>
              )}

              <View style={styles.bankHeaderBadgeRow}>
                <View style={styles.bankLogoBadge}>
                  <Icon name="business" size={18} color="#00D084" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankNameTitle}>
                    {matchedIndianBank?.name || 'HDFC Bank'}
                  </Text>
                  <Text style={styles.bankBranchText}>
                    {matchedIndianBank?.defaultBranch || 'Main Branch'}
                  </Text>
                </View>
                <Text style={styles.activePayoutTag}>Active Payout</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Account Number</Text>
                <Text style={styles.value}>•••• 8821</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>IFSC Code</Text>
                <Text style={styles.value}>HDFC0001234</Text>
              </View>

              <AppButton
                label={settling ? 'Processing Transfer...' : 'Process Driver Payout'}
                loading={settling}
                disabled={settling}
                style={styles.payoutBtn}
                onPress={handleSettlePayout}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 24, 0.85)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  driverTextGroup: {
    gap: 2,
  },
  driverName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
  },
  value: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 12,
  },
  payoutBtn: {
    marginTop: 4,
  },
  emptyBank: {
    paddingVertical: 4,
  },
  emptyBankText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyBankSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 12,
  },
  bankHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    gap: 10,
  },
  bankLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  bankBranchText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  activePayoutTag: {
    color: '#00D084',
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
