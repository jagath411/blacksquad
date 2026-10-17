import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Icon } from './ui/Icon';
import {
  getAnalyticsSummary,
  getWeeklyAnalytics,
  getExpenses,
  createExpense,
  deleteExpense,
  getPayoutStatements,
  settleDriverPayout,
  type AnalyticsSummary,
  type DailyAnalytics,
  type ExpenseItem,
  type DriverPayoutStatement,
} from '../services/analyticsService';
import { formatUnifiedError } from '../utils/errorHandler';
import { fonts } from '../theme/fonts';

interface FleetAnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  onShowNotification: (title: string, body: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  FUEL: 'Fuel',
  MAINTENANCE: 'Maintenance',
  TOLL: 'Toll',
  INSURANCE: 'Insurance',
  PERMIT: 'Permit',
  OTHER: 'Other',
};

type TabType = 'OVERVIEW' | 'EXPENSES' | 'PAYOUTS';

export function FleetAnalyticsModal({ visible, onClose, onShowNotification }: FleetAnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data States
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [weekly, setWeekly] = useState<DailyAnalytics[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [payouts, setPayouts] = useState<DriverPayoutStatement[]>([]);

  // Expense Form State
  const [expenseCategory, setExpenseCategory] = useState<'FUEL' | 'MAINTENANCE' | 'TOLL' | 'INSURANCE' | 'OTHER'>('FUEL');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseLiters, setExpenseLiters] = useState('');
  const [expenseOdometer, setExpenseOdometer] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseReceipt, setExpenseReceipt] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Settlement Modal State
  const [settleModalDriver, setSettleModalDriver] = useState<DriverPayoutStatement | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('UPI');
  const [settleRef, setSettleRef] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [sumRes, weekRes, expRes, payRes] = await Promise.all([
        getAnalyticsSummary(),
        getWeeklyAnalytics(),
        getExpenses(),
        getPayoutStatements(),
      ]);
      setSummary(sumRes);
      setWeekly(weekRes);
      setExpenses(expRes);
      setPayouts(payRes);
    } catch (err: any) {
      const formatted = formatUnifiedError(err);
      onShowNotification(formatted.title, formatted.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  // Handle Add Expense
  const handleAddExpense = async () => {
    const numAmount = parseFloat(expenseAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowNotification('Invalid Amount', 'Please enter a valid expense amount in ₹.', 'warning');
      return;
    }

    setSubmittingExpense(true);
    try {
      await createExpense({
        category: expenseCategory,
        amount: numAmount,
        liters: expenseLiters ? parseFloat(expenseLiters) : undefined,
        odometerKm: expenseOdometer ? parseFloat(expenseOdometer) : undefined,
        notes: expenseNotes.trim() || undefined,
        receiptNumber: expenseReceipt.trim() || undefined,
      });

      onShowNotification('Expense Recorded', `₹${numAmount.toLocaleString()} logged under ${expenseCategory}.`, 'success');
      setExpenseAmount('');
      setExpenseLiters('');
      setExpenseOdometer('');
      setExpenseNotes('');
      setExpenseReceipt('');
      await loadData(true);
    } catch (err: any) {
      const formatted = formatUnifiedError(err);
      onShowNotification(formatted.title, formatted.message, 'error');
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string, amount: number) => {
    try {
      await deleteExpense(id);
      onShowNotification('Expense Deleted', `Removed expense entry of ₹${amount.toLocaleString()}.`, 'info');
      await loadData(true);
    } catch (err: any) {
      const formatted = formatUnifiedError(err);
      onShowNotification(formatted.title, formatted.message, 'error');
    }
  };

  // Handle Submit Settlement
  const handleSettleSubmit = async () => {
    if (!settleModalDriver) return;
    const numAmount = parseFloat(settleAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowNotification('Invalid Amount', 'Please enter a valid settlement payout amount.', 'warning');
      return;
    }
    if (!settleRef.trim()) {
      onShowNotification('Reference Required', 'Please enter UPI Transaction ID or Bank UTR number.', 'warning');
      return;
    }

    setSubmittingSettle(true);
    try {
      await settleDriverPayout({
        driverId: settleModalDriver.driverId,
        amount: numAmount,
        paymentMethod: settleMethod,
        transactionReference: settleRef.trim(),
      });

      onShowNotification(
        'Payout recorded',
        `₹${numAmount.toLocaleString()} paid to ${settleModalDriver.driverName} via ${settleMethod}.`,
        'success',
      );
      setSettleModalDriver(null);
      setSettleAmount('');
      setSettleRef('');
      await loadData(true);
    } catch (err: any) {
      const formatted = formatUnifiedError(err);
      onShowNotification(formatted.title, formatted.message, 'error');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Max value for chart scaling
  const maxWeeklyValue = Math.max(
    ...weekly.map((w) => Math.max(w.revenue, w.expense)),
    1000,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <View style={s.headerBadge}>
                <Icon name="stats-chart" size={16} color="#1E8E5A" />
                <Text style={s.headerBadgeText}>Earnings and costs</Text>
              </View>
              <Text style={s.headerTitle}>This week</Text>
            </View>
            <View style={s.headerRight}>
              <Pressable style={s.iconBtn} onPress={() => loadData(true)} disabled={refreshing}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#1E8E5A" />
                ) : (
                  <Icon name="refresh" size={18} color="#5B6573" />
                )}
              </Pressable>
              <Pressable style={s.iconBtn} onPress={onClose}>
                <Icon name="close" size={20} color="#5B6573" />
              </Pressable>
            </View>
          </View>

          {/* Navigation Tab Pills */}
          <View style={s.tabRow}>
            <Pressable
              style={[s.tabPill, activeTab === 'OVERVIEW' && s.tabPillActive]}
              onPress={() => setActiveTab('OVERVIEW')}
            >
              <Icon name="pie-chart" size={14} color={activeTab === 'OVERVIEW' ? '#FFFFFF' : '#5B6573'} />
              <Text style={[s.tabPillText, activeTab === 'OVERVIEW' && s.tabPillTextActive]}>
                Overview
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'EXPENSES' && s.tabPillActive]}
              onPress={() => setActiveTab('EXPENSES')}
            >
              <Icon name="speedometer" size={14} color={activeTab === 'EXPENSES' ? '#FFFFFF' : '#5B6573'} />
              <Text style={[s.tabPillText, activeTab === 'EXPENSES' && s.tabPillTextActive]}>
                Expenses
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'PAYOUTS' && s.tabPillActive]}
              onPress={() => setActiveTab('PAYOUTS')}
            >
              <Icon name="cash" size={14} color={activeTab === 'PAYOUTS' ? '#FFFFFF' : '#5B6573'} />
              <Text style={[s.tabPillText, activeTab === 'PAYOUTS' && s.tabPillTextActive]}>
                Payouts
              </Text>
            </Pressable>
          </View>

          {/* Main Scrollable Content */}
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#1E8E5A" />
              <Text style={s.loadingText}>Aggregating fleet financial telemetry...</Text>
            </View>
          ) : (
            <ScrollView style={s.contentScroll} showsVerticalScrollIndicator={false}>
              {/* TAB 1: OVERVIEW & WEEKLY CHARTS */}
              {activeTab === 'OVERVIEW' && summary && (
                <View style={s.tabSection}>
                  {/* KPI Cards Grid */}
                  <View style={s.kpiGrid}>
                    {/* Gross Revenue */}
                    <View style={s.kpiCard}>
                      <View style={s.kpiIconBox}>
                        <Icon name="trending-up" size={18} color="#1E8E5A" />
                      </View>
                      <Text style={s.kpiLabel}>Gross revenue</Text>
                      <Text style={s.kpiValue}>₹{summary.grossRevenue.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>{summary.totalTrips} completed trips</Text>
                    </View>

                    {/* Fuel & Fleet Expenses */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(31, 63, 184, 0.13)' }]}>
                        <Icon name="speedometer" size={18} color="#B7791F" />
                      </View>
                      <Text style={s.kpiLabel}>Fuel & expenses</Text>
                      <Text style={[s.kpiValue, { color: '#B7791F' }]}>₹{summary.totalExpenses.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>₹{summary.fuelExpenses.toLocaleString()} on fuel</Text>
                    </View>

                    {/* Net Fleet Profit */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                        <Icon name="wallet" size={18} color="#2457D6" />
                      </View>
                      <Text style={s.kpiLabel}>Net fleet profit</Text>
                      <Text style={[s.kpiValue, { color: '#2457D6' }]}>₹{summary.netFleetProfit.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>After driver share and costs</Text>
                    </View>

                    {/* Pending Driver Payouts */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(200, 55, 45, 0.15)' }]}>
                        <Icon name="people" size={18} color="#C8372D" />
                      </View>
                      <Text style={s.kpiLabel}>Pending payouts</Text>
                      <Text style={[s.kpiValue, { color: '#C8372D' }]}>₹{summary.pendingDriverPayouts.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>₹{summary.settledPayoutsTotal.toLocaleString()} paid so far</Text>
                    </View>
                  </View>

                  {/* 7-Day Revenue & Expense Bar Chart */}
                  <View style={s.chartCard}>
                    <View style={s.chartHeader}>
                      <View>
                        <Text style={s.chartTitle}>Last 7 days</Text>
                        <Text style={s.chartSubtitle}>Fares earned and money spent each day</Text>
                      </View>
                      <View style={s.chartLegend}>
                        <View style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: '#1E8E5A' }]} />
                          <Text style={s.legendText}>Revenue</Text>
                        </View>
                        <View style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: '#1F3FB8' }]} />
                          <Text style={s.legendText}>Expenses</Text>
                        </View>
                      </View>
                    </View>

                    {/* Bar Chart Visualization */}
                    <View style={s.barContainer}>
                      {weekly.map((d, index) => {
                        const revHeight = Math.max(8, (d.revenue / maxWeeklyValue) * 110);
                        const expHeight = Math.max(8, (d.expense / maxWeeklyValue) * 110);

                        return (
                          <View key={index} style={s.barColumn}>
                            <View style={s.barPair}>
                              {/* Revenue Bar */}
                              <View
                                style={[
                                  s.bar,
                                  {
                                    height: revHeight,
                                    backgroundColor: '#1E8E5A',
                                  },
                                ]}
                              />
                              {/* Expense Bar */}
                              <View
                                style={[
                                  s.bar,
                                  {
                                    height: expHeight,
                                    backgroundColor: '#1F3FB8',
                                  },
                                ]}
                              />
                            </View>
                            <Text style={s.barDayLabel}>{d.dayName}</Text>
                            <Text style={s.barValLabel}>₹{d.revenue > 0 ? (d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue) : '0'}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: FUEL & EXPENSES LEDGER */}
              {activeTab === 'EXPENSES' && (
                <View style={s.tabSection}>
                  {/* Record New Expense Form */}
                  <View style={s.formCard}>
                    <Text style={s.formCardTitle}>⛽ Record Fleet Expense</Text>
                    <Text style={s.formCardSubtitle}>Log diesel fuel receipts, maintenance bills, and tolls.</Text>

                    {/* Category Selector Pills */}
                    <View style={s.categoryRow}>
                      {(['FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'OTHER'] as const).map((cat) => (
                        <Pressable
                          key={cat}
                          style={[s.catPill, expenseCategory === cat && s.catPillActive]}
                          onPress={() => setExpenseCategory(cat)}
                        >
                          <Text style={[s.catPillText, expenseCategory === cat && s.catPillTextActive]}>
                            {CATEGORY_NAMES[cat]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Inputs */}
                    <View style={s.inputGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabel}>AMOUNT (₹) *</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. 2500"
                          placeholderTextColor="#7A8592"
                          keyboardType="numeric"
                          value={expenseAmount}
                          onChangeText={setExpenseAmount}
                        />
                      </View>

                      {expenseCategory === 'FUEL' && (
                        <View style={{ flex: 1 }}>
                          <Text style={s.inputLabel}>Liters</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. 25.5"
                            placeholderTextColor="#7A8592"
                            keyboardType="numeric"
                            value={expenseLiters}
                            onChangeText={setExpenseLiters}
                          />
                        </View>
                      )}
                    </View>

                    <View style={s.inputGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabel}>Odometer (KM)</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. 42150"
                          placeholderTextColor="#7A8592"
                          keyboardType="numeric"
                          value={expenseOdometer}
                          onChangeText={setExpenseOdometer}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabel}>RECEIPT / BILL NO.</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. HP-9941"
                          placeholderTextColor="#7A8592"
                          value={expenseReceipt}
                          onChangeText={setExpenseReceipt}
                        />
                      </View>
                    </View>

                    <Text style={s.inputLabel}>Notes / remarks</Text>
                    <TextInput
                      style={[s.textInput, { height: 44 }]}
                      placeholder="e.g. Shell Petrol Bunk Koramangala"
                      placeholderTextColor="#7A8592"
                      value={expenseNotes}
                      onChangeText={setExpenseNotes}
                    />

                    <Pressable
                      style={[s.submitBtn, submittingExpense && { opacity: 0.6 }]}
                      onPress={handleAddExpense}
                      disabled={submittingExpense}
                    >
                      {submittingExpense ? (
                        <ActivityIndicator size="small" color="#1D232B" />
                      ) : (
                        <Text style={s.submitBtnText}>+ Record Expense Entry</Text>
                      )}
                    </Pressable>
                  </View>

                  {/* Expense History List */}
                  <View style={s.listHeaderRow}>
                    <Text style={s.listSectionTitle}>Expense History ({expenses.length})</Text>
                  </View>

                  {expenses.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Icon name="receipt-outline" size={32} color="#7A8592" />
                      <Text style={s.emptyTitle}>No Expenses Logged</Text>
                      <Text style={s.emptySub}>Record fuel and maintenance receipts to track true net profits.</Text>
                    </View>
                  ) : (
                    expenses.map((exp) => (
                      <View key={exp._id} style={s.expenseRowCard}>
                        <View style={s.expenseIconBox}>
                          <Icon
                            name={exp.category === 'FUEL' ? 'water' : exp.category === 'MAINTENANCE' ? 'build' : exp.category === 'TOLL' ? 'git-merge' : 'document-text'}
                            size={18}
                            color="#1D232B"
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.expenseCatTitle}>{exp.category}</Text>
                            {exp.receiptNumber && (
                              <View style={s.receiptBadge}>
                                <Text style={s.receiptBadgeText}>#{exp.receiptNumber}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.expenseSub}>
                            {new Date(exp.date).toLocaleDateString()} {exp.liters ? `• ${exp.liters}L` : ''} {exp.odometerKm ? `• ${exp.odometerKm}km` : ''}
                          </Text>
                          {exp.notes && <Text style={s.expenseNote}>{exp.notes}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.expenseAmountText}>-₹{exp.amount.toLocaleString()}</Text>
                          <Pressable
                            style={s.deleteBtn}
                            onPress={() => handleDeleteExpense(exp._id, exp.amount)}
                          >
                            <Icon name="trash-outline" size={14} color="#C8372D" />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: DRIVER PAYOUT SETTLEMENTS */}
              {activeTab === 'PAYOUTS' && (
                <View style={s.tabSection}>
                  <View style={s.listHeaderRow}>
                    <Text style={s.listSectionTitle}>Driver Earnings & Settlements</Text>
                    <Text style={s.listSubText}>80% standard driver commission split</Text>
                  </View>

                  {payouts.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Icon name="people-outline" size={32} color="#7A8592" />
                      <Text style={s.emptyTitle}>No Drivers Found</Text>
                      <Text style={s.emptySub}>Assigned fleet drivers will appear here with automated earnings.</Text>
                    </View>
                  ) : (
                    payouts.map((driver) => (
                      <View key={driver.driverId} style={s.driverPayoutCard}>
                        <View style={s.driverHeader}>
                          <View style={s.driverAvatar}>
                            <Text style={s.driverAvatarText}>👤</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.driverName}>{driver.driverName}</Text>
                            <Text style={s.driverMeta}>
                              {driver.vehicle?.registrationNumber || 'No vehicle'} • {driver.totalTrips} completed trips
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.pendingLabel}>Pending balance</Text>
                            <Text style={s.pendingVal}>₹{driver.pendingBalance.toLocaleString()}</Text>
                          </View>
                        </View>

                        {/* Breakdown Pills */}
                        <View style={s.payoutBreakdownGrid}>
                          <View style={s.breakdownCol}>
                            <Text style={s.breakdownLabel}>Gross Fares</Text>
                            <Text style={s.breakdownVal}>₹{driver.grossFares.toLocaleString()}</Text>
                          </View>
                          <View style={s.breakdownCol}>
                            <Text style={s.breakdownLabel}>Driver Share (80%)</Text>
                            <Text style={[s.breakdownVal, { color: '#1E8E5A' }]}>₹{driver.totalEarnings.toLocaleString()}</Text>
                          </View>
                          <View style={s.breakdownCol}>
                            <Text style={s.breakdownLabel}>Paid to Date</Text>
                            <Text style={[s.breakdownVal, { color: '#5B6573' }]}>₹{driver.settledAmount.toLocaleString()}</Text>
                          </View>
                        </View>

                        {/* Bank / UPI Info */}
                        {driver.bankDetails?.ifscCode || driver.bankDetails?.upiId ? (
                          <View style={s.bankDetailStrip}>
                            <Icon name="card-outline" size={14} color="#1E8E5A" />
                            <Text style={s.bankDetailText}>
                              {driver.bankDetails.bankName || 'Bank'}: {driver.bankDetails.accountNumber ? `••••${driver.bankDetails.accountNumber.slice(-4)}` : ''} ({driver.bankDetails.ifscCode})
                              {driver.bankDetails.upiId ? ` • UPI: ${driver.bankDetails.upiId}` : ''}
                            </Text>
                          </View>
                        ) : null}

                        {/* Settle Action Button */}
                        <Pressable
                          style={[s.settleBtn, driver.pendingBalance <= 0 && { opacity: 0.5 }]}
                          onPress={() => {
                            setSettleModalDriver(driver);
                            setSettleAmount(driver.pendingBalance > 0 ? driver.pendingBalance.toString() : '');
                          }}
                        >
                          <Icon name="checkmark-done" size={16} color="#1D232B" />
                          <Text style={s.settleBtnText}>Settle Driver Payout</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Settle Payout Sub-Modal */}
          {settleModalDriver && (
            <Modal visible transparent animationType="fade">
              <View style={s.settleOverlay}>
                <View style={s.settleCard}>
                  <View style={s.settleCardHeader}>
                    <Text style={s.settleCardTitle}>💵 Settle Driver Earnings</Text>
                    <Pressable onPress={() => setSettleModalDriver(null)}>
                      <Icon name="close" size={20} color="#5B6573" />
                    </Pressable>
                  </View>

                  <Text style={s.settleRecipient}>
                    Recipient: <Text style={{ color: '#1E8E5A', fontFamily: fonts.w700 }}>{settleModalDriver.driverName}</Text>
                  </Text>

                  <Text style={s.inputLabel}>PAYOUT AMOUNT (₹) *</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="Amount to settle"
                    placeholderTextColor="#7A8592"
                    keyboardType="numeric"
                    value={settleAmount}
                    onChangeText={setSettleAmount}
                  />

                  <Text style={s.inputLabel}>Payment method</Text>
                  <View style={s.methodRow}>
                    {(['UPI', 'BANK_TRANSFER', 'CASH'] as const).map((m) => (
                      <Pressable
                        key={m}
                        style={[s.methodPill, settleMethod === m && s.methodPillActive]}
                        onPress={() => setSettleMethod(m)}
                      >
                        <Text style={[s.methodPillText, settleMethod === m && s.methodPillTextActive]}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={s.inputLabel}>TRANSACTION REFERENCE (UTR / UPI ID) *</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="e.g. UTR20260825991823"
                    placeholderTextColor="#7A8592"
                    value={settleRef}
                    onChangeText={setSettleRef}
                  />

                  <Pressable
                    style={[s.confirmSettleBtn, submittingSettle && { opacity: 0.6 }]}
                    onPress={handleSettleSubmit}
                    disabled={submittingSettle}
                  >
                    {submittingSettle ? (
                      <ActivityIndicator size="small" color="#1D232B" />
                    ) : (
                      <Text style={s.confirmSettleBtnText}>Confirm Settlement & Issue Receipt</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create<{
  modalOverlay: ViewStyle;
  modalContainer: ViewStyle;
  headerRow: ViewStyle;
  headerLeft: ViewStyle;
  headerBadge: ViewStyle;
  headerBadgeText: TextStyle;
  headerTitle: TextStyle;
  headerRight: ViewStyle;
  iconBtn: ViewStyle;
  tabRow: ViewStyle;
  tabPill: ViewStyle;
  tabPillActive: ViewStyle;
  tabPillText: TextStyle;
  tabPillTextActive: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  contentScroll: ViewStyle;
  tabSection: ViewStyle;
  kpiGrid: ViewStyle;
  kpiCard: ViewStyle;
  kpiIconBox: ViewStyle;
  kpiLabel: TextStyle;
  kpiValue: TextStyle;
  kpiSub: TextStyle;
  chartCard: ViewStyle;
  chartHeader: ViewStyle;
  chartTitle: TextStyle;
  chartSubtitle: TextStyle;
  chartLegend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendText: TextStyle;
  barContainer: ViewStyle;
  barColumn: ViewStyle;
  barPair: ViewStyle;
  bar: ViewStyle;
  barDayLabel: TextStyle;
  barValLabel: TextStyle;
  formCard: ViewStyle;
  formCardTitle: TextStyle;
  formCardSubtitle: TextStyle;
  categoryRow: ViewStyle;
  catPill: ViewStyle;
  catPillActive: ViewStyle;
  catPillText: TextStyle;
  catPillTextActive: TextStyle;
  inputGrid: ViewStyle;
  inputLabel: TextStyle;
  textInput: TextStyle;
  submitBtn: ViewStyle;
  submitBtnText: TextStyle;
  listHeaderRow: ViewStyle;
  listSectionTitle: TextStyle;
  listSubText: TextStyle;
  emptyBox: ViewStyle;
  emptyTitle: TextStyle;
  emptySub: TextStyle;
  expenseRowCard: ViewStyle;
  expenseIconBox: ViewStyle;
  expenseCatTitle: TextStyle;
  receiptBadge: ViewStyle;
  receiptBadgeText: TextStyle;
  expenseSub: TextStyle;
  expenseNote: TextStyle;
  expenseAmountText: TextStyle;
  deleteBtn: ViewStyle;
  driverPayoutCard: ViewStyle;
  driverHeader: ViewStyle;
  driverAvatar: ViewStyle;
  driverAvatarText: TextStyle;
  driverName: TextStyle;
  driverMeta: TextStyle;
  pendingLabel: TextStyle;
  pendingVal: TextStyle;
  payoutBreakdownGrid: ViewStyle;
  breakdownCol: ViewStyle;
  breakdownLabel: TextStyle;
  breakdownVal: TextStyle;
  bankDetailStrip: ViewStyle;
  bankDetailText: TextStyle;
  settleBtn: ViewStyle;
  settleBtnText: TextStyle;
  settleOverlay: ViewStyle;
  settleCard: ViewStyle;
  settleCardHeader: ViewStyle;
  settleCardTitle: TextStyle;
  settleRecipient: TextStyle;
  methodRow: ViewStyle;
  methodPill: ViewStyle;
  methodPillActive: ViewStyle;
  methodPillText: TextStyle;
  methodPillTextActive: TextStyle;
  confirmSettleBtn: ViewStyle;
  confirmSettleBtnText: TextStyle;
}>({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(29, 35, 43, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#F3F5F7',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(30, 142, 90, 0.30)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 35, 43, 0.08)',
  },
  headerLeft: { flex: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: { color: '#1E8E5A', fontSize: 11, fontFamily: fonts.w700, },
  headerTitle: { color: '#1D232B', fontSize: 20, fontFamily: fonts.w700, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DBE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#F3F5F7',
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#1F3FB8',
    borderColor: '#1F3FB8',
  },
  tabPillText: { color: '#5B6573', fontSize: 12, fontFamily: fonts.w600,},
  tabPillTextActive: { color: '#FFFFFF', fontFamily: fonts.w700 },
  loadingContainer: { padding: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#5B6573', fontSize: 13, fontFamily: fonts.w500,},
  contentScroll: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  tabSection: { paddingBottom: 24 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 142, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiLabel: { color: '#5B6573', fontSize: 10, fontFamily: fonts.w700, },
  kpiValue: { color: '#1E8E5A', fontSize: 20, fontFamily: fonts.w700, marginTop: 4 },
  kpiSub: { color: '#7A8592', fontSize: 11, marginTop: 4, fontFamily: fonts.w500,},
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: { color: '#1D232B', fontSize: 15, fontFamily: fonts.w700,},
  chartSubtitle: { color: '#7A8592', fontSize: 11, fontFamily: fonts.w400, marginTop: 2 },
  chartLegend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w600,},
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 35, 43, 0.10)',
    paddingBottom: 6,
  },
  barColumn: { alignItems: 'center', flex: 1 },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 110,
    marginBottom: 6,
  },
  bar: { width: 10, borderRadius: 5 },
  barDayLabel: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w600,},
  barValLabel: { color: '#7A8592', fontSize: 9, marginTop: 2, fontFamily: fonts.w600,},
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 90, 0.20)',
    marginBottom: 20,
  },
  formCardTitle: { color: '#1D232B', fontSize: 16, fontFamily: fonts.w700,},
  formCardSubtitle: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w400, marginTop: 2, marginBottom: 14 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E9EDF1',
    borderWidth: 1,
    borderColor: '#D5DBE2',
  },
  catPillActive: { backgroundColor: '#1E8E5A', borderColor: '#1E8E5A' },
  catPillText: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w600,},
  catPillTextActive: { color: '#1D232B', fontFamily: fonts.w700 },
  inputGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputLabel: { color: '#5B6573', fontSize: 10, fontFamily: fonts.w700, marginBottom: 4, letterSpacing: 0.5 },
  textInput: {
    backgroundColor: '#F3F5F7',
    borderWidth: 1,
    borderColor: '#D5DBE2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#1D232B',
    fontSize: 13, fontFamily: fonts.w400,
  },
  submitBtn: {
    backgroundColor: '#1E8E5A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitBtnText: { color: '#1D232B', fontSize: 13, fontFamily: fonts.w700,},
  listHeaderRow: { marginBottom: 12 },
  listSectionTitle: { color: '#1D232B', fontSize: 16, fontFamily: fonts.w700,},
  listSubText: { color: '#7A8592', fontSize: 11, fontFamily: fonts.w400, marginTop: 2 },
  emptyBox: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#1D232B', fontSize: 14, fontFamily: fonts.w700, marginTop: 8 },
  emptySub: { color: '#7A8592', fontSize: 12, fontFamily: fonts.w400, textAlign: 'center', marginTop: 4 },
  expenseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.06)',
  },
  expenseIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E9EDF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCatTitle: { color: '#1D232B', fontSize: 13, fontFamily: fonts.w700,},
  receiptBadge: { backgroundColor: '#D5DBE2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  receiptBadgeText: { color: '#5B6573', fontSize: 9, fontFamily: fonts.w600,},
  expenseSub: { color: '#7A8592', fontSize: 11, fontFamily: fonts.w400, marginTop: 2 },
  expenseNote: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w400, marginTop: 4, fontStyle: 'italic' },
  expenseAmountText: { color: '#C8372D', fontSize: 14, fontFamily: fonts.w700,},
  deleteBtn: { padding: 4, marginTop: 4 },
  driverPayoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  driverHeader: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E9EDF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 18 , fontFamily: fonts.w400,},
  driverName: { color: '#1D232B', fontSize: 15, fontFamily: fonts.w700,},
  driverMeta: { color: '#7A8592', fontSize: 11, fontFamily: fonts.w400, marginTop: 2 },
  pendingLabel: { color: '#5B6573', fontSize: 9, fontFamily: fonts.w700,},
  pendingVal: { color: '#C8372D', fontSize: 16, fontFamily: fonts.w700, marginTop: 2 },
  payoutBreakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F5F7',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  breakdownCol: { alignItems: 'center', flex: 1 },
  breakdownLabel: { color: '#7A8592', fontSize: 10, fontFamily: fonts.w600,},
  breakdownVal: { color: '#1D232B', fontSize: 13, fontFamily: fonts.w700, marginTop: 2 },
  bankDetailStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 142, 90, 0.10)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  bankDetailText: { color: '#1E8E5A', fontSize: 11, fontFamily: fonts.w600, flex: 1 },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E8E5A',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  settleBtnText: { color: '#1D232B', fontSize: 12, fontFamily: fonts.w700,},
  settleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(29, 35, 43, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  settleCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E8E5A',
  },
  settleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  settleCardTitle: { color: '#1D232B', fontSize: 17, fontFamily: fonts.w700,},
  settleRecipient: { color: '#5B6573', fontSize: 13, fontFamily: fonts.w400, marginBottom: 14 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  methodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E9EDF1',
    borderWidth: 1,
    borderColor: '#D5DBE2',
  },
  methodPillActive: { backgroundColor: '#1E8E5A', borderColor: '#1E8E5A' },
  methodPillText: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w700,},
  methodPillTextActive: { color: '#1D232B', fontFamily: fonts.w700 },
  confirmSettleBtn: {
    backgroundColor: '#1E8E5A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmSettleBtnText: { color: '#1D232B', fontSize: 13, fontFamily: fonts.w700,},
});
