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
import { Icon } from './ui/Icon';
import { AppButton } from './AppButton';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  type ExpenseItem,
} from '../services/analyticsService';
import { getFleetVehicles, type FleetVehicle } from '../services/vehicleService';
import { formatUnifiedError } from '../utils/errorHandler';

interface Props {
  visible: boolean;
  onClose: () => void;
  onExpenseUpdated?: () => void;
}

const CATEGORIES = [
  { id: 'FUEL', label: 'Fuel', icon: 'speedometer', color: '#F59E0B' },
  { id: 'MAINTENANCE', label: 'Maintenance', icon: 'build', color: '#38BDF8' },
  { id: 'TOLL', label: 'Toll', icon: 'navigate', color: '#10B981' },
  { id: 'INSURANCE', label: 'Insurance', icon: 'shield-checkmark', color: '#8B5CF6' },
  { id: 'PERMIT', label: 'Permit', icon: 'document-text', color: '#EC4899' },
  { id: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle', color: '#94A3B8' },
];

export function FleetExpensesModal({ visible, onClose, onExpenseUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState<string>('FUEL');
  const [amount, setAmount] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [liters, setLiters] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [expData, vehData] = await Promise.all([getExpenses(), getFleetVehicles()]);
      setExpenses(expData);
      setVehicles(vehData);
      if (vehData.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vehData[0]._id);
      }
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadData();
    }
  }, [visible]);

  const handleCreate = async () => {
    const numAmount = parseFloat(amount.trim());
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount in ₹.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createExpense({
        category,
        amount: numAmount,
        vehicleId: selectedVehicleId || undefined,
        liters: category === 'FUEL' && liters ? parseFloat(liters) : undefined,
        odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setSuccessMsg('Expense logged successfully!');
      // Reset form
      setAmount('');
      setLiters('');
      setOdometerKm('');
      setReceiptNumber('');
      setNotes('');
      setActiveTab('list');
      void loadData();
      onExpenseUpdated?.();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      setDeletingId(id);
      try {
        await deleteExpense(id);
        setExpenses((prev) => prev.filter((e) => e._id !== id));
        onExpenseUpdated?.();
      } catch (err: any) {
        setErrorMsg(formatUnifiedError(err).message);
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this expense record?')) {
        void performDelete();
      }
    } else {
      Alert.alert('Delete Expense', 'Are you sure you want to delete this expense record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
      ]);
    }
  };

  // KPIs
  const totalSpend = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const fuelSpend = expenses
    .filter((e) => e.category === 'FUEL')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const maintenanceSpend = expenses
    .filter((e) => e.category === 'MAINTENANCE')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const tollSpend = expenses
    .filter((e) => e.category === 'TOLL')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const filteredExpenses =
    selectedFilter === 'ALL'
      ? expenses
      : expenses.filter((e) => e.category === selectedFilter);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalCard}>
          {/* Header */}
          <View style={s.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.headerIconWrap}>
                <Icon name="receipt" size={20} color="#00D084" />
              </View>
              <View>
                <Text style={s.title}>Fleet Operating Expenses</Text>
                <Text style={s.subtitle}>Log and monitor fuel, tolls, and maintenance costs</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Icon name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Quick Metrics Bar */}
          <View style={s.metricsRow}>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Total Spend</Text>
              <Text style={s.metricValue}>₹{totalSpend.toLocaleString('en-IN')}</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Fuel</Text>
              <Text style={[s.metricValue, { color: '#F59E0B' }]}>₹{fuelSpend.toLocaleString('en-IN')}</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Maintenance</Text>
              <Text style={[s.metricValue, { color: '#38BDF8' }]}>₹{maintenanceSpend.toLocaleString('en-IN')}</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Tolls & Permits</Text>
              <Text style={[s.metricValue, { color: '#10B981' }]}>₹{tollSpend.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={s.tabsRow}>
            <Pressable
              style={[s.tab, activeTab === 'list' && s.activeTab]}
              onPress={() => {
                setActiveTab('list');
                setErrorMsg(null);
              }}
            >
              <Icon name="list" size={14} color={activeTab === 'list' ? '#00D084' : '#64748B'} />
              <Text style={[s.tabText, activeTab === 'list' && s.activeTabText]}>
                Expense History ({expenses.length})
              </Text>
            </Pressable>
            <Pressable
              style={[s.tab, activeTab === 'create' && s.activeTab]}
              onPress={() => {
                setActiveTab('create');
                setErrorMsg(null);
              }}
            >
              <Icon name="add-circle" size={14} color={activeTab === 'create' ? '#00D084' : '#64748B'} />
              <Text style={[s.tabText, activeTab === 'create' && s.activeTabText]}>
                + Log New Expense
              </Text>
            </Pressable>
          </View>

          {/* Alerts */}
          {errorMsg ? (
            <View style={s.errorBanner}>
              <Icon name="alert-circle" size={16} color="#F87171" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={s.successBanner}>
              <Icon name="checkmark-circle" size={16} color="#00D084" />
              <Text style={s.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#00D084" />
              <Text style={s.loadingText}>Loading fleet expense ledger...</Text>
            </View>
          ) : activeTab === 'list' ? (
            /* ========================================================================= */
            /* TAB 1: EXPENSE HISTORY LIST */
            /* ========================================================================= */
            <View style={{ flex: 1 }}>
              {/* Category Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
                <Pressable
                  style={[s.filterPill, selectedFilter === 'ALL' && s.filterPillActive]}
                  onPress={() => setSelectedFilter('ALL')}
                >
                  <Text style={[s.filterPillText, selectedFilter === 'ALL' && s.filterPillTextActive]}>
                    All ({expenses.length})
                  </Text>
                </Pressable>
                {CATEGORIES.map((cat) => {
                  const count = expenses.filter((e) => e.category === cat.id).length;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[s.filterPill, selectedFilter === cat.id && s.filterPillActive]}
                      onPress={() => setSelectedFilter(cat.id)}
                    >
                      <Text
                        style={[
                          s.filterPillText,
                          selectedFilter === cat.id && s.filterPillTextActive,
                        ]}
                      >
                        {cat.label} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filteredExpenses.length === 0 ? (
                <View style={s.emptyBox}>
                  <Icon name="receipt-outline" size={44} color="#334155" />
                  <Text style={s.emptyTitle}>No Expenses Recorded</Text>
                  <Text style={s.emptyDesc}>
                    {selectedFilter === 'ALL'
                      ? 'Log your fleet fuel, toll, and maintenance receipts to calculate exact net profit.'
                      : `No expenses found in category '${selectedFilter}'.`}
                  </Text>
                  <Pressable style={s.emptyAddBtn} onPress={() => setActiveTab('create')}>
                    <Text style={s.emptyAddBtnText}>+ Log First Expense</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView style={s.listScroll} contentContainerStyle={{ paddingBottom: 24 }}>
                  {filteredExpenses.map((exp) => {
                    const catMeta = CATEGORIES.find((c) => c.id === exp.category) || {
                      label: exp.category,
                      icon: 'receipt',
                      color: '#94A3B8',
                    };
                    const dateFormatted = new Date(exp.date || exp.createdAt).toLocaleDateString(
                      'en-IN',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    );

                    return (
                      <View key={exp._id} style={s.expenseCard}>
                        <View style={[s.categoryIconWrap, { backgroundColor: `${catMeta.color}20` }]}>
                          <Icon name={catMeta.icon as any} size={18} color={catMeta.color} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={s.expenseCardHeader}>
                            <Text style={s.expenseCategoryName}>{catMeta.label}</Text>
                            <Text style={s.expenseAmount}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                          </View>

                          <View style={s.expenseDetailsRow}>
                            {exp.vehicleId ? (
                              <View style={s.vehicleBadge}>
                                <Icon name="car" size={11} color="#38BDF8" />
                                <Text style={s.vehicleBadgeText}>
                                  {exp.vehicleId.registrationNumber} {exp.vehicleId.model ? `(${exp.vehicleId.model})` : ''}
                                </Text>
                              </View>
                            ) : null}

                            {exp.liters ? (
                              <Text style={s.detailMetaText}>⛽ {exp.liters} Liters</Text>
                            ) : null}

                            {exp.odometerKm ? (
                              <Text style={s.detailMetaText}>📍 {exp.odometerKm.toLocaleString()} km</Text>
                            ) : null}

                            {exp.receiptNumber ? (
                              <Text style={s.detailMetaText}>🧾 #{exp.receiptNumber}</Text>
                            ) : null}
                          </View>

                          {exp.notes ? <Text style={s.expenseNotes}>{exp.notes}</Text> : null}

                          <Text style={s.expenseDate}>{dateFormatted}</Text>
                        </View>

                        <Pressable
                          style={s.deleteBtn}
                          disabled={deletingId === exp._id}
                          onPress={() => handleDelete(exp._id)}
                        >
                          {deletingId === exp._id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Icon name="trash-outline" size={16} color="#EF4444" />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ========================================================================= */
            /* TAB 2: CREATE EXPENSE FORM */
            /* ========================================================================= */
            <ScrollView style={s.formScroll} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Category Picker */}
              <Text style={s.inputLabel}>Expense Category *</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        s.categoryCard,
                        isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}15` },
                      ]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Icon name={cat.icon as any} size={20} color={isSelected ? cat.color : '#64748B'} />
                      <Text style={[s.categoryCardLabel, isSelected && { color: cat.color, fontWeight: '800' }]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Amount Input */}
              <Text style={s.inputLabel}>Amount (₹) *</Text>
              <TextInput
                style={s.textInput}
                value={amount}
                onChangeText={(t) => {
                  setAmount(t.replace(/[^0-9.]/g, ''));
                  setErrorMsg(null);
                }}
                placeholder="e.g. 1500"
                placeholderTextColor="#475569"
                keyboardType="numeric"
              />

              {/* Vehicle Selection */}
              <Text style={s.inputLabel}>Associated Vehicle (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.vehScroll}>
                <Pressable
                  style={[s.vehPill, !selectedVehicleId && s.vehPillActive]}
                  onPress={() => setSelectedVehicleId('')}
                >
                  <Text style={[s.vehPillText, !selectedVehicleId && s.vehPillTextActive]}>
                    General Fleet
                  </Text>
                </Pressable>
                {vehicles.map((v) => (
                  <Pressable
                    key={v._id}
                    style={[s.vehPill, selectedVehicleId === v._id && s.vehPillActive]}
                    onPress={() => setSelectedVehicleId(v._id)}
                  >
                    <Icon name="car" size={12} color={selectedVehicleId === v._id ? '#00D084' : '#64748B'} />
                    <Text style={[s.vehPillText, selectedVehicleId === v._id && s.vehPillTextActive]}>
                      {v.registrationNumber} {v.model ? `• ${v.model}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Fuel Liters (shown if category is FUEL) */}
              {category === 'FUEL' && (
                <>
                  <Text style={s.inputLabel}>Fuel Liters (Optional)</Text>
                  <TextInput
                    style={s.textInput}
                    value={liters}
                    onChangeText={setLiters}
                    placeholder="e.g. 35.5"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Odometer & Receipt */}
              <View style={s.dualRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Odometer (km)</Text>
                  <TextInput
                    style={s.textInput}
                    value={odometerKm}
                    onChangeText={setOdometerKm}
                    placeholder="e.g. 45200"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Receipt / Bill #</Text>
                  <TextInput
                    style={s.textInput}
                    value={receiptNumber}
                    onChangeText={setReceiptNumber}
                    placeholder="e.g. INV-9812"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={s.inputLabel}>Notes & Description</Text>
              <TextInput
                style={[s.textInput, { height: 70, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Full tank diesel at Shell MG Road"
                placeholderTextColor="#475569"
                multiline
              />

              <AppButton
                label={submitting ? 'Recording Expense...' : 'Save & Record Expense'}
                loading={submitting}
                disabled={submitting || !amount.trim()}
                onPress={handleCreate}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create<{
  overlay: ViewStyle;
  modalCard: ViewStyle;
  headerRow: ViewStyle;
  headerIconWrap: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  closeBtn: ViewStyle;
  metricsRow: ViewStyle;
  metricBox: ViewStyle;
  metricLabel: TextStyle;
  metricValue: TextStyle;
  tabsRow: ViewStyle;
  tab: ViewStyle;
  activeTab: ViewStyle;
  tabText: TextStyle;
  activeTabText: TextStyle;
  filterScroll: ViewStyle;
  filterPill: ViewStyle;
  filterPillActive: ViewStyle;
  filterPillText: TextStyle;
  filterPillTextActive: TextStyle;
  errorBanner: ViewStyle;
  errorText: TextStyle;
  successBanner: ViewStyle;
  successText: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  listScroll: ViewStyle;
  expenseCard: ViewStyle;
  categoryIconWrap: ViewStyle;
  expenseCardHeader: ViewStyle;
  expenseCategoryName: TextStyle;
  expenseAmount: TextStyle;
  expenseDetailsRow: ViewStyle;
  vehicleBadge: ViewStyle;
  vehicleBadgeText: TextStyle;
  detailMetaText: TextStyle;
  expenseNotes: TextStyle;
  expenseDate: TextStyle;
  deleteBtn: ViewStyle;
  emptyBox: ViewStyle;
  emptyTitle: TextStyle;
  emptyDesc: TextStyle;
  emptyAddBtn: ViewStyle;
  emptyAddBtnText: TextStyle;
  formScroll: ViewStyle;
  inputLabel: TextStyle;
  categoryGrid: ViewStyle;
  categoryCard: ViewStyle;
  categoryCardLabel: TextStyle;
  textInput: TextStyle;
  vehScroll: ViewStyle;
  vehPill: ViewStyle;
  vehPillActive: ViewStyle;
  vehPillText: TextStyle;
  vehPillTextActive: TextStyle;
  dualRow: ViewStyle;
}>({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 13, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.25)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.3)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#00D084',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  filterPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#00D084',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00D084',
    marginBottom: 12,
  },
  successText: {
    color: '#00D084',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
  },
  listScroll: {
    flex: 1,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategoryName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '800',
  },
  expenseAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  expenseDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vehicleBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  detailMetaText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  expenseNotes: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
  },
  expenseDate: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyDesc: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: '#00D084',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#07100D',
    fontSize: 12,
    fontWeight: '900',
  },
  formScroll: {
    flex: 1,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryCardLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  vehScroll: {
    flexGrow: 0,
    marginBottom: 6,
  },
  vehPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  vehPillActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  vehPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  vehPillTextActive: {
    color: '#00D084',
  },
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
