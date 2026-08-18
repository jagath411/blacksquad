import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { radius, spacing } from '../theme';
import { findBankByCodeOrName } from '../utils/allIndianBanks';
import { getBankInfo } from '../utils/bankRegistry';

export interface DriverDetailData {
  id: string;
  name: string;
  vehicle: string;
  state: 'Online' | 'Stale' | 'Offline';
  color: string;
  latitude: number;
  longitude: number;
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    upiId?: string;
  };
}

interface DriverDetailModalProps {
  driver: DriverDetailData | null;
  onClose: () => void;
  onTrackOnMap: (lat: number, lng: number) => void;
}

export function DriverDetailModal({ driver, onClose, onTrackOnMap }: DriverDetailModalProps) {
  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);

  if (!driver) return null;

  const handleSettlePayout = () => {
    setSettling(true);
    setTimeout(() => {
      setSettling(false);
      setSettled(true);
      setTimeout(() => setSettled(false), 5000);
    }, 1200);
  };

  const matchedIndianBank = findBankByCodeOrName(driver.bankDetails?.bankName || '');
  const bankInfo = getBankInfo(driver.bankDetails?.bankName);
  const activeLogo = matchedIndianBank?.logoUrl;
  const activeColor = matchedIndianBank?.brandColor || bankInfo.color;

  return (
    <Modal visible={Boolean(driver)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.driverInfo}>
                <View style={[styles.avatar, { backgroundColor: driver.color }]}>
                  <Text style={styles.avatarText}>{driver.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.driverTextGroup}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: driver.color }]} />
                    <Text style={[styles.statusText, { color: driver.color }]}>{driver.state}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {settled && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ Payout settlement processed for {driver.name}!</Text>
              </View>
            )}

            {/* Vehicle & Telematics */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Vehicle & GPS Telematics</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Vehicle Assigned</Text>
                <Text style={styles.value}>{driver.vehicle || 'Fleet Truck'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Current GPS Coordinates</Text>
                <Text style={styles.value}>{driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Telemetry Status</Text>
                <Text style={[styles.value, { color: driver.color }]}>{driver.state}</Text>
              </View>

              <AppButton
                label="📍 Center & Track on Live Map"
                variant="secondary"
                style={styles.trackBtn}
                onPress={() => {
                  onTrackOnMap(driver.latitude, driver.longitude);
                  onClose();
                }}
              />
            </View>

            {/* Payout & Bank Account Details with Real Bank Logo */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Bank Account & Payout Details</Text>
              {driver.bankDetails && (driver.bankDetails.bankName || driver.bankDetails.upiId) ? (
                <>
                  <View style={[styles.bankHeaderBadgeRow, { borderColor: activeColor }]}>
                    <View style={[styles.bankLogoBadge, { backgroundColor: activeColor }]}>
                      {activeLogo ? (
                        <Image source={{ uri: activeLogo }} style={{ width: 22, height: 22, borderRadius: 11 }} resizeMode="contain" />
                      ) : (
                        <Text style={styles.bankLogoIcon}>{matchedIndianBank?.logoEmoji || bankInfo.logo}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankNameTitle}>{driver.bankDetails.bankName || matchedIndianBank?.name || bankInfo.name}</Text>
                      <Text style={styles.bankBranchText}>{driver.bankDetails.branchName || matchedIndianBank?.defaultBranch || bankInfo.defaultBranch}</Text>
                    </View>
                    <Text style={styles.activePayoutTag}>Active Payout</Text>
                  </View>

                  {driver.bankDetails.accountHolderName && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Account Holder</Text>
                      <Text style={styles.value}>{driver.bankDetails.accountHolderName}</Text>
                    </View>
                  )}
                  {driver.bankDetails.accountNumber && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Account Number</Text>
                      <Text style={styles.value}>•••• {driver.bankDetails.accountNumber.slice(-4)}</Text>
                    </View>
                  )}
                  {driver.bankDetails.ifscCode && (
                    <View style={styles.row}>
                      <Text style={styles.label}>IFSC / SWIFT Code</Text>
                      <Text style={styles.value}>{driver.bankDetails.ifscCode}</Text>
                    </View>
                  )}
                  {driver.bankDetails.upiId && (
                    <View style={styles.row}>
                      <Text style={styles.label}>UPI / Instant Pay Handle</Text>
                      <Text style={[styles.value, { color: '#38BDF8' }]}>{driver.bankDetails.upiId}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyBank}>
                  <Text style={styles.emptyBankText}>Default Company Payout Account Active</Text>
                  <Text style={styles.emptyBankSub}>Driver has not updated custom bank details yet.</Text>
                </View>
              )}

              <AppButton
                label={settling ? 'Processing Transfer...' : '💳 Process Driver Payout'}
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
    backgroundColor: 'rgba(7, 16, 13, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  driverTextGroup: {
    gap: 2,
  },
  driverName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
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
    fontSize: 12,
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
  closeBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#94A3B8',
    fontSize: 13,
  },
  value: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  trackBtn: {
    marginTop: spacing.xs,
  },
  payoutBtn: {
    marginTop: spacing.xs,
  },
  emptyBank: {
    paddingVertical: spacing.sm,
  },
  emptyBankText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyBankSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
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
  bankHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  bankLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoIcon: {
    fontSize: 18,
  },
  bankNameTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  bankBranchText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  activePayoutTag: {
    color: '#34D399',
    backgroundColor: '#064E3B',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
