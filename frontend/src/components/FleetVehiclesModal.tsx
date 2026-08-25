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
  createFleetVehicle,
  deleteFleetVehicle,
  getFleetVehicles,
  updateFleetVehicle,
  type FleetVehicle,
  type FuelType,
  type VehicleStatus,
} from '../services/vehicleService';
import { useFleet } from '../hooks/useFleet';
import { formatUnifiedError } from '../utils/errorHandler';

interface Props {
  visible: boolean;
  onClose: () => void;
  onVehicleUpdated?: () => void;
}

const VEHICLE_TYPES = [
  { id: 'SEDAN', label: 'Sedan', icon: 'car-sport' },
  { id: 'SUV', label: 'SUV / MPV', icon: 'car' },
  { id: 'VAN', label: 'Comfort Van', icon: 'bus' },
  { id: 'TRUCK', label: 'Freight Truck', icon: 'cube' },
];

const FUEL_TYPES: Array<{ id: FuelType; label: string; icon: string }> = [
  { id: 'DIESEL', label: 'Diesel', icon: 'water' },
  { id: 'PETROL', label: 'Petrol', icon: 'flame' },
  { id: 'CNG', label: 'CNG Eco', icon: 'leaf' },
  { id: 'EV', label: 'Electric EV', icon: 'flash' },
];

export function FleetVehiclesModal({ visible, onClose, onVehicleUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionVehicleId, setActionVehicleId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { drivers } = useFleet();

  // Create Form State
  const [regNumber, setRegNumber] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('SEDAN');
  const [fuelType, setFuelType] = useState<FuelType>('DIESEL');
  const [capacity, setCapacity] = useState('4');
  const [odometerKm, setOdometerKm] = useState('');
  const [assignedDriverId, setAssignedDriverId] = useState<string>('');

  const loadVehicles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getFleetVehicles();
      setVehicles(data);
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadVehicles();
    }
  }, [visible]);

  const handleCreate = async () => {
    const cleanedReg = regNumber.trim().toUpperCase();
    if (!cleanedReg || cleanedReg.length < 4) {
      setErrorMsg('Please enter a valid registration plate (e.g. KA01AB1234).');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createFleetVehicle({
        registrationNumber: cleanedReg,
        model: model.trim() || 'Fleet Vehicle',
        vehicleType,
        fuelType,
        capacity: parseInt(capacity, 10) || 4,
        odometerKm: odometerKm ? parseFloat(odometerKm) : 0,
        driverId: assignedDriverId || null,
        status: 'ACTIVE',
      });

      setSuccessMsg(`Vehicle ${cleanedReg} added to fleet!`);
      setRegNumber('');
      setModel('');
      setOdometerKm('');
      setAssignedDriverId('');
      setActiveTab('list');
      void loadVehicles();
      onVehicleUpdated?.();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (vehicle: FleetVehicle) => {
    const nextStatus: VehicleStatus = vehicle.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    setActionVehicleId(vehicle._id);
    try {
      await updateFleetVehicle(vehicle._id, { status: nextStatus });
      setVehicles((prev) =>
        prev.map((v) => (v._id === vehicle._id ? { ...v, status: nextStatus } : v))
      );
      onVehicleUpdated?.();
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setActionVehicleId(null);
    }
  };

  const handleDriverAssign = async (vehicleId: string, driverId: string | null) => {
    setActionVehicleId(vehicleId);
    try {
      const updated = await updateFleetVehicle(vehicleId, { driverId });
      setVehicles((prev) => prev.map((v) => (v._id === vehicleId ? updated : v)));
      onVehicleUpdated?.();
    } catch (err: any) {
      setErrorMsg(formatUnifiedError(err).message);
    } finally {
      setActionVehicleId(null);
    }
  };

  const handleDelete = (vehicle: FleetVehicle) => {
    const performDelete = async () => {
      setActionVehicleId(vehicle._id);
      try {
        await deleteFleetVehicle(vehicle._id);
        setVehicles((prev) => prev.filter((v) => v._id !== vehicle._id));
        onVehicleUpdated?.();
      } catch (err: any) {
        setErrorMsg(formatUnifiedError(err).message);
      } finally {
        setActionVehicleId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete vehicle ${vehicle.registrationNumber} from fleet?`)) {
        void performDelete();
      }
    } else {
      Alert.alert(
        'Delete Vehicle',
        `Are you sure you want to remove ${vehicle.registrationNumber} from your fleet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
        ]
      );
    }
  };

  // KPIs
  const totalCount = vehicles.length;
  const activeCount = vehicles.filter((v) => v.status === 'ACTIVE').length;
  const maintCount = vehicles.filter((v) => v.status === 'MAINTENANCE').length;
  const assignedCount = vehicles.filter((v) => Boolean(v.driverId)).length;

  const filteredVehicles =
    statusFilter === 'ALL' ? vehicles : vehicles.filter((v) => v.status === statusFilter);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalCard}>
          {/* Header */}
          <View style={s.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.headerIconWrap}>
                <Icon name="car" size={20} color="#00D084" />
              </View>
              <View>
                <Text style={s.title}>Fleet Vehicle Registry</Text>
                <Text style={s.subtitle}>Manage vehicles, driver assignments & maintenance</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Icon name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Metrics */}
          <View style={s.metricsRow}>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Total Fleet</Text>
              <Text style={s.metricValue}>{totalCount} Units</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Active on Road</Text>
              <Text style={[s.metricValue, { color: '#00D084' }]}>{activeCount}</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>In Service</Text>
              <Text style={[s.metricValue, { color: '#F59E0B' }]}>{maintCount}</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricLabel}>Driver Assigned</Text>
              <Text style={[s.metricValue, { color: '#38BDF8' }]}>{assignedCount}</Text>
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
              <Icon name="car" size={14} color={activeTab === 'list' ? '#00D084' : '#64748B'} />
              <Text style={[s.tabText, activeTab === 'list' && s.activeTabText]}>
                Vehicle Inventory ({vehicles.length})
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
                + Add New Vehicle
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
              <Text style={s.loadingText}>Loading fleet registry...</Text>
            </View>
          ) : activeTab === 'list' ? (
            /* ========================================================================= */
            /* TAB 1: VEHICLE INVENTORY LIST */
            /* ========================================================================= */
            <View style={{ flex: 1 }}>
              {/* Status Filter Pills */}
              <View style={s.filterRow}>
                {['ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'].map((st) => (
                  <Pressable
                    key={st}
                    style={[s.filterPill, statusFilter === st && s.filterPillActive]}
                    onPress={() => setStatusFilter(st)}
                  >
                    <Text style={[s.filterPillText, statusFilter === st && s.filterPillTextActive]}>
                      {st === 'ALL' ? 'All Vehicles' : st}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredVehicles.length === 0 ? (
                <View style={s.emptyBox}>
                  <Icon name="car-outline" size={44} color="#334155" />
                  <Text style={s.emptyTitle}>No Vehicles Found</Text>
                  <Text style={s.emptyDesc}>
                    Add your fleet cars, vans, or trucks to track driver assignments and maintenance.
                  </Text>
                  <Pressable style={s.emptyAddBtn} onPress={() => setActiveTab('create')}>
                    <Text style={s.emptyAddBtnText}>+ Register First Vehicle</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView style={s.listScroll} contentContainerStyle={{ paddingBottom: 24 }}>
                  {filteredVehicles.map((veh) => {
                    const isMaint = veh.status === 'MAINTENANCE';
                    const assignedDriverName = veh.driverId?.userId?.name;
                    const assignedDriverPhone = veh.driverId?.userId?.phoneNumber;

                    return (
                      <View key={veh._id} style={s.vehicleCard}>
                        <View style={s.vehicleCardTop}>
                          <View style={s.plateContainer}>
                            <Text style={s.plateNumber}>{veh.registrationNumber}</Text>
                            <View
                              style={[
                                s.statusBadge,
                                {
                                  backgroundColor:
                                    veh.status === 'ACTIVE'
                                      ? 'rgba(0, 208, 132, 0.12)'
                                      : 'rgba(245, 158, 11, 0.12)',
                                  borderColor:
                                    veh.status === 'ACTIVE' ? '#00D084' : '#F59E0B',
                                },
                              ]}
                            >
                              <View
                                style={[
                                  s.statusDot,
                                  { backgroundColor: veh.status === 'ACTIVE' ? '#00D084' : '#F59E0B' },
                                ]}
                              />
                              <Text
                                style={[
                                  s.statusBadgeText,
                                  { color: veh.status === 'ACTIVE' ? '#00D084' : '#F59E0B' },
                                ]}
                              >
                                {veh.status}
                              </Text>
                            </View>
                          </View>

                          <View style={s.actionBtnsRow}>
                            <Pressable
                              style={s.maintToggleBtn}
                              disabled={actionVehicleId === veh._id}
                              onPress={() => handleStatusToggle(veh)}
                            >
                              <Icon
                                name={isMaint ? 'play-circle' : 'build'}
                                size={14}
                                color={isMaint ? '#00D084' : '#F59E0B'}
                              />
                              <Text
                                style={[
                                  s.maintToggleText,
                                  { color: isMaint ? '#00D084' : '#F59E0B' },
                                ]}
                              >
                                {isMaint ? 'Set Active' : 'Service'}
                              </Text>
                            </Pressable>

                            <Pressable
                              style={s.deleteBtn}
                              disabled={actionVehicleId === veh._id}
                              onPress={() => handleDelete(veh)}
                            >
                              <Icon name="trash-outline" size={16} color="#EF4444" />
                            </Pressable>
                          </View>
                        </View>

                        {/* Specs row */}
                        <View style={s.specsRow}>
                          <Text style={s.modelText}>{veh.model || 'Standard Fleet Vehicle'}</Text>
                          <Text style={s.specDivider}>•</Text>
                          <Text style={s.specBadgeText}>{veh.vehicleType}</Text>
                          {veh.fuelType ? (
                            <>
                              <Text style={s.specDivider}>•</Text>
                              <Text style={s.specBadgeText}>{veh.fuelType}</Text>
                            </>
                          ) : null}
                          {veh.odometerKm ? (
                            <>
                              <Text style={s.specDivider}>•</Text>
                              <Text style={s.specBadgeText}>{veh.odometerKm.toLocaleString()} km</Text>
                            </>
                          ) : null}
                        </View>

                        {/* Driver Assignment Card */}
                        <View style={s.driverAssignCard}>
                          <Icon name="person" size={14} color={assignedDriverName ? '#38BDF8' : '#64748B'} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.driverAssignLabel}>Assigned Driver</Text>
                            <Text style={s.driverAssignName}>
                              {assignedDriverName
                                ? `${assignedDriverName} (${assignedDriverPhone || 'Verified'})`
                                : 'No Driver Assigned'}
                            </Text>
                          </View>

                          {/* Quick Assign / Unassign Driver Button */}
                          {assignedDriverName ? (
                            <Pressable
                              style={s.unassignBtn}
                              onPress={() => handleDriverAssign(veh._id, null)}
                            >
                              <Text style={s.unassignBtnText}>Unlink</Text>
                            </Pressable>
                          ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
                              {drivers.slice(0, 3).map((d) => (
                                <Pressable
                                  key={d.id}
                                  style={s.quickDriverPill}
                                  onPress={() => handleDriverAssign(veh._id, d.id)}
                                >
                                  <Text style={s.quickDriverPillText}>+ {d.name.split(' ')[0]}</Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ========================================================================= */
            /* TAB 2: REGISTER NEW VEHICLE FORM */
            /* ========================================================================= */
            <ScrollView style={s.formScroll} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Registration Number */}
              <Text style={s.inputLabel}>Registration Plate Number *</Text>
              <TextInput
                style={[s.textInput, { textTransform: 'uppercase', letterSpacing: 2, fontWeight: '900' }]}
                value={regNumber}
                onChangeText={(t) => {
                  setRegNumber(t);
                  setErrorMsg(null);
                }}
                placeholder="e.g. KA 01 AB 1234"
                placeholderTextColor="#475569"
                autoCapitalize="characters"
              />

              {/* Make & Model */}
              <Text style={s.inputLabel}>Vehicle Make & Model *</Text>
              <TextInput
                style={s.textInput}
                value={model}
                onChangeText={setModel}
                placeholder="e.g. Hyundai Aura Prime 2024"
                placeholderTextColor="#475569"
              />

              {/* Vehicle Type Grid */}
              <Text style={s.inputLabel}>Vehicle Classification *</Text>
              <View style={s.typeGrid}>
                {VEHICLE_TYPES.map((t) => {
                  const isSelected = vehicleType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[s.typeCard, isSelected && s.typeCardActive]}
                      onPress={() => setVehicleType(t.id)}
                    >
                      <Icon name={t.icon as any} size={18} color={isSelected ? '#00D084' : '#64748B'} />
                      <Text style={[s.typeCardLabel, isSelected && { color: '#00D084', fontWeight: '800' }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Fuel Type Grid */}
              <Text style={s.inputLabel}>Fuel / Powertrain Type *</Text>
              <View style={s.typeGrid}>
                {FUEL_TYPES.map((f) => {
                  const isSelected = fuelType === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      style={[s.typeCard, isSelected && s.typeCardActive]}
                      onPress={() => setFuelType(f.id)}
                    >
                      <Icon name={f.icon as any} size={18} color={isSelected ? '#00D084' : '#64748B'} />
                      <Text style={[s.typeCardLabel, isSelected && { color: '#00D084', fontWeight: '800' }]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Capacity & Odometer */}
              <View style={s.dualRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Passenger Capacity</Text>
                  <TextInput
                    style={s.textInput}
                    value={capacity}
                    onChangeText={setCapacity}
                    placeholder="4"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Current Odometer (km)</Text>
                  <TextInput
                    style={s.textInput}
                    value={odometerKm}
                    onChangeText={setOdometerKm}
                    placeholder="e.g. 12500"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Initial Driver Assignment */}
              <Text style={s.inputLabel}>Assign Driver Partner (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.driverScroll}>
                <Pressable
                  style={[s.driverPill, !assignedDriverId && s.driverPillActive]}
                  onPress={() => setAssignedDriverId('')}
                >
                  <Text style={[s.driverPillText, !assignedDriverId && s.driverPillTextActive]}>
                    Unassigned (Pool)
                  </Text>
                </Pressable>
                {drivers.map((d) => (
                  <Pressable
                    key={d.id}
                    style={[s.driverPill, assignedDriverId === d.id && s.driverPillActive]}
                    onPress={() => setAssignedDriverId(d.id)}
                  >
                    <Icon name="person" size={12} color={assignedDriverId === d.id ? '#00D084' : '#64748B'} />
                    <Text style={[s.driverPillText, assignedDriverId === d.id && s.driverPillTextActive]}>
                      {d.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <AppButton
                label={submitting ? 'Registering Vehicle...' : 'Register Fleet Vehicle'}
                loading={submitting}
                disabled={submitting || !regNumber.trim()}
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
  filterRow: ViewStyle;
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
  vehicleCard: ViewStyle;
  vehicleCardTop: ViewStyle;
  plateContainer: ViewStyle;
  plateNumber: TextStyle;
  statusBadge: ViewStyle;
  statusDot: ViewStyle;
  statusBadgeText: TextStyle;
  actionBtnsRow: ViewStyle;
  maintToggleBtn: ViewStyle;
  maintToggleText: TextStyle;
  deleteBtn: ViewStyle;
  specsRow: ViewStyle;
  modelText: TextStyle;
  specDivider: TextStyle;
  specBadgeText: TextStyle;
  driverAssignCard: ViewStyle;
  driverAssignLabel: TextStyle;
  driverAssignName: TextStyle;
  unassignBtn: ViewStyle;
  unassignBtnText: TextStyle;
  quickDriverPill: ViewStyle;
  quickDriverPillText: TextStyle;
  emptyBox: ViewStyle;
  emptyTitle: TextStyle;
  emptyDesc: TextStyle;
  emptyAddBtn: ViewStyle;
  emptyAddBtnText: TextStyle;
  formScroll: ViewStyle;
  inputLabel: TextStyle;
  textInput: TextStyle;
  typeGrid: ViewStyle;
  typeCard: ViewStyle;
  typeCardActive: ViewStyle;
  typeCardLabel: TextStyle;
  dualRow: ViewStyle;
  driverScroll: ViewStyle;
  driverPill: ViewStyle;
  driverPillActive: ViewStyle;
  driverPillText: TextStyle;
  driverPillTextActive: TextStyle;
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
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
  vehicleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  vehicleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plateNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  maintToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  maintToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 4,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modelText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },
  specDivider: {
    color: '#475569',
    fontSize: 12,
  },
  specBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  driverAssignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginTop: 2,
  },
  driverAssignLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  driverAssignName: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  unassignBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  unassignBtnText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
  },
  quickDriverPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickDriverPillText: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '700',
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  typeCard: {
    width: '48.5%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeCardActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    borderColor: '#00D084',
  },
  typeCardLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  driverScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  driverPill: {
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
  driverPillActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  driverPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  driverPillTextActive: {
    color: '#00D084',
  },
});
