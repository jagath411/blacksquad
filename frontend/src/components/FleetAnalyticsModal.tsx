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

interface FleetAnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  onShowNotification: (title: string, body: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

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
        'Payout Settled! 💵',
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
                <Icon name="stats-chart" size={16} color="#10B981" />
                <Text style={s.headerBadgeText}>FLEET ANALYTICS & REVENUE</Text>
              </View>
              <Text style={s.headerTitle}>Financial Overview</Text>
            </View>
            <View style={s.headerRight}>
              <Pressable style={s.iconBtn} onPress={() => loadData(true)} disabled={refreshing}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Icon name="refresh" size={18} color="#94A3B8" />
                )}
              </Pressable>
              <Pressable style={s.iconBtn} onPress={onClose}>
                <Icon name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>
          </View>

          {/* Navigation Tab Pills */}
          <View style={s.tabRow}>
            <Pressable
              style={[s.tabPill, activeTab === 'OVERVIEW' && s.tabPillActive]}
              onPress={() => setActiveTab('OVERVIEW')}
            >
              <Icon name="pie-chart" size={14} color={activeTab === 'OVERVIEW' ? '#07100D' : '#94A3B8'} />
              <Text style={[s.tabPillText, activeTab === 'OVERVIEW' && s.tabPillTextActive]}>
                Overview & Charts
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'EXPENSES' && s.tabPillActive]}
              onPress={() => setActiveTab('EXPENSES')}
            >
              <Icon name="speedometer" size={14} color={activeTab === 'EXPENSES' ? '#07100D' : '#94A3B8'} />
              <Text style={[s.tabPillText, activeTab === 'EXPENSES' && s.tabPillTextActive]}>
                Fuel & Expenses
              </Text>
            </Pressable>

            <Pressable
              style={[s.tabPill, activeTab === 'PAYOUTS' && s.tabPillActive]}
              onPress={() => setActiveTab('PAYOUTS')}
            >
              <Icon name="cash" size={14} color={activeTab === 'PAYOUTS' ? '#07100D' : '#94A3B8'} />
              <Text style={[s.tabPillText, activeTab === 'PAYOUTS' && s.tabPillTextActive]}>
                Driver Payouts
              </Text>
            </Pressable>
          </View>

          {/* Main Scrollable Content */}
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
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
                        <Icon name="trending-up" size={18} color="#10B981" />
                      </View>
                      <Text style={s.kpiLabel}>GROSS REVENUE</Text>
                      <Text style={s.kpiValue}>₹{summary.grossRevenue.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>{summary.totalTrips} Completed Trips</Text>
                    </View>

                    {/* Fuel & Fleet Expenses */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Icon name="speedometer" size={18} color="#F59E0B" />
                      </View>
                      <Text style={s.kpiLabel}>FUEL & EXPENSES</Text>
                      <Text style={[s.kpiValue, { color: '#F59E0B' }]}>₹{summary.totalExpenses.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>₹{summary.fuelExpenses.toLocaleString()} Fuel Spent</Text>
                    </View>

                    {/* Net Fleet Profit */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                        <Icon name="wallet" size={18} color="#3B82F6" />
                      </View>
                      <Text style={s.kpiLabel}>NET FLEET PROFIT</Text>
                      <Text style={[s.kpiValue, { color: '#3B82F6' }]}>₹{summary.netFleetProfit.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>After Driver Cut & Costs</Text>
                    </View>

                    {/* Pending Driver Payouts */}
                    <View style={s.kpiCard}>
                      <View style={[s.kpiIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <Icon name="people" size={18} color="#EF4444" />
                      </View>
                      <Text style={s.kpiLabel}>PENDING PAYOUTS</Text>
                      <Text style={[s.kpiValue, { color: '#EF4444' }]}>₹{summary.pendingDriverPayouts.toLocaleString()}</Text>
                      <Text style={s.kpiSub}>₹{summary.settledPayoutsTotal.toLocaleString()} Settled</Text>
                    </View>
                  </View>

                  {/* 7-Day Revenue & Expense Bar Chart */}
                  <View style={s.chartCard}>
                    <View style={s.chartHeader}>
                      <View>
                        <Text style={s.chartTitle}>7-Day Revenue vs Expenses</Text>
                        <Text style={s.chartSubtitle}>Daily breakdown of bookings and fleet operational cost</Text>
                      </View>
                      <View style={s.chartLegend}>
                        <View style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: '#10B981' }]} />
                          <Text style={s.legendText}>Revenue</Text>
                        </View>
                        <View style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: '#F59E0B' }]} />
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
                                    backgroundColor: '#10B981',
                                  },
                                ]}
                              />
                              {/* Expense Bar */}
                              <View
                                style={[
                                  s.bar,
                                  {
                                    height: expHeight,
                                    backgroundColor: '#F59E0B',
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
                            {cat === 'FUEL' ? '⛽ FUEL' : cat === 'MAINTENANCE' ? '🛠️ MAINT' : cat === 'TOLL' ? '🛣️ TOLL' : cat}
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
                          placeholderTextColor="#64748B"
                          keyboardType="numeric"
                          value={expenseAmount}
                          onChangeText={setExpenseAmount}
                        />
                      </View>

                      {expenseCategory === 'FUEL' && (
                        <View style={{ flex: 1 }}>
                          <Text style={s.inputLabel}>LITERS</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. 25.5"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            value={expenseLiters}
                            onChangeText={setExpenseLiters}
                          />
                        </View>
                      )}
                    </View>

                    <View style={s.inputGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabel}>ODOMETER (KM)</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. 42150"
                          placeholderTextColor="#64748B"
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
                          placeholderTextColor="#64748B"
                          value={expenseReceipt}
                          onChangeText={setExpenseReceipt}
                        />
                      </View>
                    </View>

                    <Text style={s.inputLabel}>NOTES / REMARKS</Text>
                    <TextInput
                      style={[s.textInput, { height: 44 }]}
                      placeholder="e.g. Shell Petrol Bunk Koramangala"
                      placeholderTextColor="#64748B"
                      value={expenseNotes}
                      onChangeText={setExpenseNotes}
                    />

                    <Pressable
                      style={[s.submitBtn, submittingExpense && { opacity: 0.6 }]}
                      onPress={handleAddExpense}
                      disabled={submittingExpense}
                    >
                      {submittingExpense ? (
                        <ActivityIndicator size="small" color="#07100D" />
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
                      <Icon name="receipt-outline" size={32} color="#64748B" />
                      <Text style={s.emptyTitle}>No Expenses Logged</Text>
                      <Text style={s.emptySub}>Record fuel and maintenance receipts to track true net profits.</Text>
                    </View>
                  ) : (
                    expenses.map((exp) => (
                      <View key={exp._id} style={s.expenseRowCard}>
                        <View style={s.expenseIconBox}>
                          <Text style={{ fontSize: 18 }}>
                            {exp.category === 'FUEL' ? '⛽' : exp.category === 'MAINTENANCE' ? '🛠️' : exp.category === 'TOLL' ? '🛣️' : '📄'}
                          </Text>
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
                            <Icon name="trash-outline" size={14} color="#EF4444" />
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
                      <Icon name="people-outline" size={32} color="#64748B" />
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
                              {driver.vehicle?.registrationNumber || 'No Vehicle'} • {driver.totalTrips} Completed Trips
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.pendingLabel}>PENDING BALANCE</Text>
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
                            <Text style={[s.breakdownVal, { color: '#10B981' }]}>₹{driver.totalEarnings.toLocaleString()}</Text>
                          </View>
                          <View style={s.breakdownCol}>
                            <Text style={s.breakdownLabel}>Paid to Date</Text>
                            <Text style={[s.breakdownVal, { color: '#94A3B8' }]}>₹{driver.settledAmount.toLocaleString()}</Text>
                          </View>
                        </View>

                        {/* Bank / UPI Info */}
                        {driver.bankDetails?.ifscCode || driver.bankDetails?.upiId ? (
                          <View style={s.bankDetailStrip}>
                            <Icon name="card-outline" size={14} color="#10B981" />
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
                          <Icon name="checkmark-done" size={16} color="#07100D" />
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
                      <Icon name="close" size={20} color="#94A3B8" />
                    </Pressable>
                  </View>

                  <Text style={s.settleRecipient}>
                    Recipient: <Text style={{ color: '#10B981', fontWeight: '800' }}>{settleModalDriver.driverName}</Text>
                  </Text>

                  <Text style={s.inputLabel}>PAYOUT AMOUNT (₹) *</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="Amount to settle"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={settleAmount}
                    onChangeText={setSettleAmount}
                  />

                  <Text style={s.inputLabel}>PAYMENT METHOD</Text>
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
                    placeholderTextColor="#64748B"
                    value={settleRef}
                    onChangeText={setSettleRef}
                  />

                  <Pressable
                    style={[s.confirmSettleBtn, submittingSettle && { opacity: 0.6 }]}
                    onPress={handleSettleSubmit}
                    disabled={submittingSettle}
                  >
                    {submittingSettle ? (
                      <ActivityIndicator size="small" color="#07100D" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#07100D',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: { flex: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#0A1512',
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  tabPillText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  tabPillTextActive: { color: '#07100D', fontWeight: '900' },
  loadingContainer: { padding: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
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
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  kpiValue: { color: '#10B981', fontSize: 20, fontWeight: '900', marginTop: 4 },
  kpiSub: { color: '#64748B', fontSize: 11, marginTop: 4, fontWeight: '500' },
  chartCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  chartSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2 },
  chartLegend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
  barDayLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  barValLabel: { color: '#64748B', fontSize: 9, marginTop: 2, fontWeight: '600' },
  formCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 20,
  },
  formCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  formCardSubtitle: { color: '#94A3B8', fontSize: 11, marginTop: 2, marginBottom: 14 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  catPillActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  catPillText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  catPillTextActive: { color: '#07100D', fontWeight: '900' },
  inputGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  textInput: {
    backgroundColor: '#07100D',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitBtnText: { color: '#07100D', fontSize: 13, fontWeight: '900' },
  listHeaderRow: { marginBottom: 12 },
  listSectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  listSubText: { color: '#64748B', fontSize: 11, marginTop: 2 },
  emptyBox: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginTop: 8 },
  emptySub: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 4 },
  expenseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  expenseIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCatTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  receiptBadge: { backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  receiptBadgeText: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  expenseSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  expenseNote: { color: '#94A3B8', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  expenseAmountText: { color: '#EF4444', fontSize: 14, fontWeight: '900' },
  deleteBtn: { padding: 4, marginTop: 4 },
  driverPayoutCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  driverHeader: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 18 },
  driverName: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  driverMeta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  pendingLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800' },
  pendingVal: { color: '#EF4444', fontSize: 16, fontWeight: '900', marginTop: 2 },
  payoutBreakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#07100D',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  breakdownCol: { alignItems: 'center', flex: 1 },
  breakdownLabel: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  breakdownVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', marginTop: 2 },
  bankDetailStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  bankDetailText: { color: '#34D399', fontSize: 11, fontWeight: '600', flex: 1 },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  settleBtnText: { color: '#07100D', fontSize: 12, fontWeight: '900' },
  settleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  settleCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  settleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  settleCardTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '900' },
  settleRecipient: { color: '#94A3B8', fontSize: 13, marginBottom: 14 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  methodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodPillActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  methodPillText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  methodPillTextActive: { color: '#07100D', fontWeight: '900' },
  confirmSettleBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmSettleBtnText: { color: '#07100D', fontSize: 13, fontWeight: '900' },
});
