import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from './ui/Icon';
import { darkColors, radius, spacing } from '../theme';
import type { BookingData, UserRole } from '../types';
import { getBookingHistory } from '../services/bookingService';
import { fonts } from '../theme/fonts';

interface Props {
  visible: boolean;
  role: UserRole;
  onClose: () => void;
}

function statusColor(status: string): string {
  switch (status) {
    case 'TRIP_COMPLETED': return '#1E8E5A';
    case 'CANCELLED': return '#C8372D';
    case 'TRIP_STARTED': return '#2457D6';
    default: return '#5B6573';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'TRIP_COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'TRIP_STARTED': return 'In Progress';
    case 'DRIVER_ARRIVING': return 'Driver Arriving';
    case 'DRIVER_ACCEPTED': return 'Driver Assigned';
    case 'ASSIGNED': return 'Searching';
    case 'REQUESTED': return 'Requested';
    default: return status;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getDriverName(booking: BookingData): string {
  const d = booking.driverId;
  if (d && typeof d === 'object' && d.userId) {
    return d.userId.name || 'Driver';
  }
  return 'Unknown Driver';
}

function getCustomerName(booking: BookingData): string {
  const c = booking.customerId;
  if (c && typeof c === 'object') {
    return (c as any).name || 'Passenger';
  }
  return 'Passenger';
}

function getVehicleInfo(booking: BookingData): string {
  const v = booking.vehicleId;
  if (v && typeof v === 'object' && v.registrationNumber) {
    return `${v.registrationNumber}${v.model ? ' • ' + v.model : ''}`;
  }
  const dv = (booking.driverId as any)?.vehicleId;
  if (dv && typeof dv === 'object' && dv.registrationNumber) {
    return `${dv.registrationNumber}${dv.model ? ' • ' + dv.model : ''}`;
  }
  return '';
}

export function TripHistoryModal({ visible, role, onClose }: Props) {
  const [trips, setTrips] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getBookingHistory();
      setTrips(data);
    } catch (e: any) {
      setError('Could not load trip history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchHistory();
  }, [visible, fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(true);
  };

  const completed = trips.filter((t) => t.status === 'TRIP_COMPLETED');
  const other = trips.filter((t) => t.status !== 'TRIP_COMPLETED');
  const sorted = [...completed, ...other];

  const totalSpent = completed.reduce((sum, t) => sum + (t.fare || 0), 0);
  const totalTrips = trips.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Icon name="time" size={20} color="#5B6573" />
            <Text style={s.headerTitle}>Trip History</Text>
          </View>
          <Pressable style={s.closeBtn} onPress={onClose}>
            <Icon name="close" size={20} color="#5B6573" />
          </Pressable>
        </View>

        {/* Stats Row */}
        {!loading && trips.length > 0 && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{totalTrips}</Text>
              <Text style={s.statLabel}>Total Trips</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCard}>
              <Text style={s.statValue}>{completed.length}</Text>
              <Text style={s.statLabel}>Completed</Text>
            </View>
            <View style={s.statDivider} />
            {role === 'CUSTOMER' ? (
              <View style={s.statCard}>
                <Text style={s.statValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
                <Text style={s.statLabel}>Total Spent</Text>
              </View>
            ) : (
              <View style={s.statCard}>
                <Text style={s.statValue}>₹{Math.round(totalSpent * 0.8).toLocaleString('en-IN')}</Text>
                <Text style={s.statLabel}>Earnings</Text>
              </View>
            )}
          </View>
        )}

        {/* Body */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#1D232B" />
            <Text style={s.loadingText}>Loading your trips...</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <Icon name="alert-circle" size={32} color="#C8372D" />
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => fetchHistory()}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : trips.length === 0 ? (
          <View style={s.center}>
            <Icon name="car" size={48} color="#5B6573" />
            <Text style={s.emptyTitle}>No trips yet</Text>
            <Text style={s.emptyMsg}>
              {role === 'CUSTOMER'
                ? 'Your completed and cancelled rides will appear here.'
                : 'Your completed and cancelled trips will appear here.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1D232B"
              />
            }
          >
            {sorted.map((trip) => {
              const color = statusColor(trip.status);
              const vehicle = getVehicleInfo(trip);
              return (
                <View key={trip._id} style={s.card}>
                  {/* Status badge + Fare */}
                  <View style={s.cardTop}>
                    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                      <View style={[s.dot, { backgroundColor: color }]} />
                      <Text style={[s.badgeText, { color }]}>{statusLabel(trip.status)}</Text>
                    </View>
                    <Text style={s.fare}>₹{trip.fare?.toLocaleString('en-IN') ?? '—'}</Text>
                  </View>

                  {/* Route */}
                  <View style={s.routeRow}>
                    <View style={s.routeIcons}>
                      <View style={s.dotGreen} />
                      <View style={s.routeLine} />
                      <View style={s.dotRed} />
                    </View>
                    <View style={s.routeAddrs}>
                      <Text style={s.routeAddr} numberOfLines={1}>{trip.pickupAddress}</Text>
                      <Text style={s.routeAddr} numberOfLines={1}>{trip.dropAddress}</Text>
                    </View>
                  </View>

                  {/* Meta row */}
                  <View style={s.metaRow}>
                    <Icon name="calendar" size={12} color="#7A8592" />
                    <Text style={s.metaText}>{formatDate(trip.createdAt)}</Text>
                    {trip.serviceTier && (
                      <>
                        <Text style={s.metaDot}>·</Text>
                        <Text style={s.metaText}>{trip.serviceTier}</Text>
                      </>
                    )}
                  </View>

                  {/* Driver / Customer info */}
                  {role === 'CUSTOMER' && trip.driverId && (
                    <View style={s.personRow}>
                      <Icon name="person" size={12} color="#7A8592" />
                      <Text style={s.personText}>
                        {getDriverName(trip)}
                        {vehicle ? `  ·  ${vehicle}` : ''}
                      </Text>
                    </View>
                  )}
                  {role === 'DRIVER' && (
                    <View style={s.personRow}>
                      <Icon name="person" size={12} color="#7A8592" />
                      <Text style={s.personText}>{getCustomerName(trip)}</Text>
                      {role === 'DRIVER' && trip.status === 'TRIP_COMPLETED' && (
                        <Text style={s.earnedBadge}>
                          +₹{Math.round((trip.fare || 0) * 0.8).toLocaleString('en-IN')} earned
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
interface Styles {
  root: ViewStyle;
  header: ViewStyle;
  headerLeft: ViewStyle;
  headerTitle: TextStyle;
  closeBtn: ViewStyle;
  statsRow: ViewStyle;
  statCard: ViewStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  statDivider: ViewStyle;
  center: ViewStyle;
  loadingText: TextStyle;
  errorText: TextStyle;
  retryBtn: ViewStyle;
  retryText: TextStyle;
  emptyTitle: TextStyle;
  emptyMsg: TextStyle;
  list: ViewStyle;
  listContent: ViewStyle;
  card: ViewStyle;
  cardTop: ViewStyle;
  badge: ViewStyle;
  dot: ViewStyle;
  badgeText: TextStyle;
  fare: TextStyle;
  routeRow: ViewStyle;
  routeIcons: ViewStyle;
  dotGreen: ViewStyle;
  routeLine: ViewStyle;
  dotRed: ViewStyle;
  routeAddrs: ViewStyle;
  routeAddr: TextStyle;
  metaRow: ViewStyle;
  metaText: TextStyle;
  metaDot: TextStyle;
  personRow: ViewStyle;
  personText: TextStyle;
  earnedBadge: TextStyle;
}

const s = StyleSheet.create<Styles>({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 35, 43, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.w600,
    color: '#1D232B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(29, 35, 43, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(29, 35, 43, 0.04)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: fonts.w700,
    color: '#1D232B',
  },
  statLabel: {
    fontSize: 11, fontFamily: fonts.w400,
    color: '#7A8592',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(29, 35, 43, 0.08)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: spacing.xl,
  },
  loadingText: {
    color: '#7A8592',
    fontSize: 14, fontFamily: fonts.w400,
  },
  errorText: {
    color: '#C8372D',
    fontSize: 14, fontFamily: fonts.w400,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: radius.md,
  },
  retryText: {
    color: '#1D232B',
    fontFamily: fonts.w600,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.w600,
    color: '#7A8592',
  },
  emptyMsg: {
    fontSize: 13, fontFamily: fonts.w400,
    color: '#5B6573',
    textAlign: 'center',
    lineHeight: 19,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(29, 35, 43, 0.04)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.06)',
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.w600,
  },
  fare: {
    fontSize: 16,
    fontFamily: fonts.w700,
    color: '#1D232B',
  },
  routeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  routeIcons: {
    alignItems: 'center',
    paddingTop: 4,
    gap: 2,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E8E5A',
  },
  routeLine: {
    width: 2,
    flex: 1,
    minHeight: 14,
    backgroundColor: 'rgba(29, 35, 43, 0.10)',
  },
  dotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8372D',
  },
  routeAddrs: {
    flex: 1,
    gap: 6,
  },
  routeAddr: {
    fontSize: 13, fontFamily: fonts.w400,
    color: '#3A4350',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11, fontFamily: fonts.w400,
    color: '#7A8592',
  },
  metaDot: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  personText: {
    fontSize: 12, fontFamily: fonts.w400,
    color: '#7A8592',
    flex: 1,
  },
  earnedBadge: {
    fontSize: 11,
    color: '#1E8E5A',
    fontFamily: fonts.w600,
  },
});
