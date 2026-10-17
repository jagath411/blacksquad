import React, { useState } from 'react';
import {
  Linking,
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
import type { FleetDriverSummary } from '../hooks/useFleet';
import { ALL_INDIAN_BANKS } from '../utils/allIndianBanks';
import { fonts } from '../theme/fonts';

interface Props {
  visible: boolean;
  driver: FleetDriverSummary | null;
  onClose: () => void;
}

export function DriverDetailModal({ visible, driver, onClose }: Props) {
  const [settling, setSettling] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  if (!driver) return null;

  const isOnline = driver.state === 'Online' || driver.state === 'On Trip';
  const matchedIndianBank = ALL_INDIAN_BANKS[0];

  const handleCallDriver = () => {
    if (driver.phone) {
      void Linking.openURL(`tel:${driver.phone.replace(/[\s-]/g, '')}`);
    }
  };

  const handleSettlePayout = async () => {
    setSettling(true);
    setPayoutSuccess(false);
    try {
      if (Platform.OS === 'web') window.alert(`Settlement of ₹4,500.00 initiated for ${driver.name} via IMPS.`);
      setPayoutSuccess(true);
    } catch {
      if (Platform.OS === 'web') window.alert('Settlement failed. Please try again.');
    } finally {
      setSettling(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.driverInfo}>
                <View style={[styles.avatar, { backgroundColor: isOnline ? '#E3F2EA' : '#E9EDF1' }]}>
                  <Icon name="person" size={20} color="#1D232B" />
                </View>
                <View style={styles.driverTextGroup}>
                  <Text style={styles.driverName}>{driver.name || 'Driver Partner'}</Text>
                  <View style={styles.statusBadge}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isOnline ? '#FFC21A' : '#C8372D' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isOnline ? '#1E8E5A' : '#C8372D' },
                      ]}
                    >
                      {driver.state === 'On Trip'
                        ? 'On Active Passenger Trip'
                        : isOnline
                        ? 'Online • Broadcasting GPS'
                        : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Icon name="close" size={18} color="#5B6573" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Quick Action Contact Bar */}
            <View style={styles.contactBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>Direct contact number</Text>
                <Text style={styles.contactPhone}>{driver.phone || 'No phone on file'}</Text>
              </View>
              <Pressable style={styles.callFab} onPress={handleCallDriver}>
                <Icon name="call" size={16} color="#1D232B" />
                <Text style={styles.callFabText}>Call Driver</Text>
              </Pressable>
            </View>

            {/* Vehicle & Telemetry Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Vehicle & fleet telemetry</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Assigned Vehicle</Text>
                <Text style={styles.valueHighlight}>{driver.vehicle || 'Fleet Pool'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Driving License</Text>
                <Text style={styles.value}>{driver.licenseNumber || 'DL-VERIFIED'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Live Telemetry Speed</Text>
                <Text style={styles.value}>
                  {driver.speed ? `${Math.round(driver.speed)} km/h` : 'Stationary (0 km/h)'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>GPS Coordinate</Text>
                <Text style={styles.value}>
                  {driver.lat != null && driver.lng != null ? `${driver.lat.toFixed(4)}, ${driver.lng.toFixed(4)}` : 'No location yet'}
                </Text>
              </View>
            </View>

            {/* Bank Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Banking & payout settlement</Text>

              {payoutSuccess && (
                <View style={styles.successBox}>
                  <Icon name="checkmark-circle" size={16} color="#1E8E5A" />
                  <Text style={styles.successText}>₹4,500.00 settled instantly via NEFT/IMPS</Text>
                </View>
              )}

              <View style={styles.bankHeaderBadgeRow}>
                <View style={styles.bankLogoBadge}>
                  <Icon name="business" size={18} color="#1E8E5A" />
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
                <Text style={styles.value}>Hdfc0001234</Text>
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
    backgroundColor: 'rgba(29, 35, 43, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 35, 43, 0.06)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(29, 35, 43, 0.14)',
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
    borderColor: 'rgba(29, 35, 43, 0.14)',
  },
  driverTextGroup: {
    gap: 2,
  },
  driverName: {
    color: '#1D232B',
    fontSize: 16,
    fontFamily: fonts.w700,
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
    fontFamily: fonts.w600,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9EDF1',
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
    backgroundColor: '#E9EDF1',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.06)',
  },
  cardHeader: {
    color: '#2457D6',
    fontSize: 11,
    fontFamily: fonts.w700,
    marginBottom: 2,
  },
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E9EDF1',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 194, 26, 0.48)',
  },
  contactLabel: {
    color: '#5B6573',
    fontSize: 9,
    fontFamily: fonts.w700,
    },
  contactPhone: {
    color: '#1E8E5A',
    fontSize: 15,
    fontFamily: fonts.w700,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  callFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFC21A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callFabText: {
    color: '#1D232B',
    fontSize: 12,
    fontFamily: fonts.w700,
  },
  valueHighlight: {
    color: '#2457D6',
    fontFamily: fonts.w700,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#5B6573',
    fontSize: 12, fontFamily: fonts.w400,
  },
  value: {
    color: '#1D232B',
    fontFamily: fonts.w700,
    fontSize: 12,
  },
  payoutBtn: {
    marginTop: 4,
  },
  emptyBank: {
    paddingVertical: 4,
  },
  emptyBankText: {
    color: '#1D232B',
    fontFamily: fonts.w600,
    fontSize: 12,
  },
  emptyBankSub: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
    marginTop: 2,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 194, 26, 0.24)',
    borderColor: '#E0A800',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    color: '#1E8E5A',
    fontFamily: fonts.w600,
    fontSize: 12,
  },
  bankHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
    padding: 10,
    gap: 10,
  },
  bankLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9EDF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameTitle: {
    color: '#1D232B',
    fontFamily: fonts.w700,
    fontSize: 13,
  },
  bankBranchText: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
  },
  activePayoutTag: {
    color: '#1E8E5A',
    backgroundColor: 'rgba(255, 194, 26, 0.24)',
    fontSize: 9,
    fontFamily: fonts.w700,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
