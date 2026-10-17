import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AddDriverModal } from '../../components/AddDriverModal';
import { DriverDetailModal } from '../../components/DriverDetailModal';
import { FleetAnalyticsModal } from '../../components/FleetAnalyticsModal';
import { FleetExpensesModal } from '../../components/FleetExpensesModal';
import { FleetVehiclesModal } from '../../components/FleetVehiclesModal';
import { MapView, type MapMarker } from '../../components/MapView';
import { NotificationBanner, type NotificationItem } from '../../components/NotificationBanner';
import { ProfileModal } from '../../components/ProfileModal';
import { Icon } from '../../components/ui/Icon';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useFleet, type FleetDriverSummary } from '../../hooks/useFleet';
import { callNumber } from '../../utils/dialogs';
import { MapHeader, RecenterButton } from './MapChrome';
import { s } from './homeStyles';

export function OwnerHomeScreen({ onLogout }: { onLogout: () => void }) {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [expensesModalVisible, setExpensesModalVisible] = useState(false);
  const [vehiclesModalVisible, setVehiclesModalVisible] = useState(false);
  const [addDriverModalVisible, setAddDriverModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<FleetDriverSummary | null>(null);
  const { drivers, refreshFleet, loading: fleetLoading } = useFleet();
  const { isLocating, locate, camera, setCamera } = useDeviceLocation();

  // Drivers with no GPS position yet are listed but not drawn on the map.
  const markers: MapMarker[] = drivers.flatMap((d) =>
    d.lat != null && d.lng != null
      ? [{ id: `fleet-${d.id}`, latitude: d.lat, longitude: d.lng, title: `${d.name} (${d.state})`, isVehicle: true, color: d.color }]
      : [],
  );

  const focusDriver = (driver: FleetDriverSummary) => {
    setSelectedDriver(driver);
    if (driver.lat != null && driver.lng != null) {
      setCamera({ center: { latitude: driver.lat, longitude: driver.lng }, zoom: 16 });
    }
  };

  return (
    <View style={s.container}>
      <NotificationBanner
        notification={notification}
        onDismiss={() => setNotification(null)}
      />

      <View style={s.mapWrapper}>
        <MapView center={camera.center} zoom={camera.zoom} markers={markers} style={s.mapFrame} />
        <MapHeader
          label="Fleet"
          icon="business"
          iconColor="#B7791F"
          onProfile={() => setProfileVisible(true)}
        />
        <RecenterButton isLocating={isLocating} onPress={() => void locate(true)} />
      </View>

      <View style={s.ownerSheet}>
        <View style={s.sheetHandle} />

        {/* Fleet Revenue & Analytics Banner Action */}
        <Pressable accessibilityRole="button"
          style={s.ownerAnalyticsBanner}
          onPress={() => setAnalyticsVisible(true)}
        >
          <View style={s.analyticsBannerIconBox}>
            <Icon name="trending-up" size={20} color="#1D232B" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.analyticsBannerTitle}>Earnings and costs</Text>
            <Text style={s.analyticsBannerSub}>Fares, expenses and driver payouts</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#5B6573" />
        </Pressable>

        {/* Quick Management Actions Grid (Vehicles & Expenses) */}
        <View style={s.ownerQuickGrid}>
          <Pressable accessibilityRole="button"
            style={s.ownerQuickCard}
            onPress={() => setVehiclesModalVisible(true)}
          >
            <View style={[s.ownerQuickIconBox, { backgroundColor: 'rgba(36, 87, 214, 0.15)' }]}>
              <Icon name="car-sport" size={16} color="#2457D6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ownerQuickCardTitle}>Vehicles</Text>
              <Text style={s.ownerQuickCardSub}>Add and assign</Text>
            </View>
          </Pressable>

          <Pressable accessibilityRole="button"
            style={s.ownerQuickCard}
            onPress={() => setExpensesModalVisible(true)}
          >
            <View style={[s.ownerQuickIconBox, { backgroundColor: 'rgba(255, 194, 26, 0.24)' }]}>
              <Icon name="receipt" size={16} color="#B7791F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ownerQuickCardTitle}>Expenses</Text>
              <Text style={s.ownerQuickCardSub}>Fuel, repairs, tolls</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.ownerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.ownerTitle}>Drivers</Text>
            <Text style={s.ownerSub}>
              {drivers && drivers.length > 0
                ? `${drivers.filter((d) => d.state !== 'Offline').length} of ${drivers.length} online`
                : fleetLoading ? 'Loading fleet…' : 'No drivers yet'}
            </Text>
          </View>
          <Pressable accessibilityRole="button"
            style={s.addDriverBtn}
            onPress={() => setAddDriverModalVisible(true)}
          >
            <Icon name="person-add" size={14} color="#1D232B" />
            <Text style={s.addDriverBtnText}>Add driver</Text>
          </Pressable>
        </View>

        <ScrollView style={s.fleetScroll} showsVerticalScrollIndicator={false}>
          {drivers && drivers.length > 0 ? (
            drivers.map((driver) => (
              <Pressable accessibilityRole="button"
                key={driver.id}
                style={s.fleetCard}
                onPress={() => focusDriver(driver)}
              >
                <View
                  style={[
                    s.fleetAvatar,
                    {
                      backgroundColor: `${driver.color}22`,
                      borderColor: driver.color,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Icon
                    name="car-sport"
                    size={18}
                    color={driver.color}
                  />
                </View>

                <View style={s.fleetMeta}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.fleetName}>{driver.name}</Text>
                    <View
                      style={[
                        s.statusPill,
                        {
                          backgroundColor: `${driver.color}22`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusPillText,
                          {
                            color: driver.color,
                          },
                        ]}
                      >
                        {driver.state}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.fleetVehicle}>
                    {driver.vehicle}
                  </Text>
                  {driver.lat == null ? <Text style={s.fleetPhoneText}>No location yet</Text> : null}
                  {driver.phone ? (
                    <Text style={s.fleetPhoneText}>
                      {driver.phone}
                    </Text>
                  ) : null}
                </View>

                <View style={s.fleetActionRow}>
                  {driver.phone ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Call ${driver.name}`}
                      style={s.fleetCallBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        callNumber(driver.phone);
                      }}
                    >
                      <Icon name="call" size={16} color="#1D232B" />
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={`Show ${driver.name} on the map`}
                    style={s.fleetFocusBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      focusDriver(driver);
                    }}
                  >
                    <Icon name="navigate" size={14} color="#2457D6" />
                  </Pressable>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={s.emptyFleet}>
              <Icon name="car-sport-outline" size={36} color="#7A8592" />
              <Text style={s.emptyFleetText}>No drivers yet. Add a driver by their phone number and they can sign in straight away.</Text>
              <Pressable accessibilityRole="button"
                style={s.emptyFleetAddBtn}
                onPress={() => setAddDriverModalVisible(true)}
              >
                <Text style={s.emptyFleetAddBtnText}>Add your first driver</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      <FleetAnalyticsModal
        visible={analyticsVisible}
        onClose={() => setAnalyticsVisible(false)}
        onShowNotification={(title, body, type) =>
          setNotification({
            id: Date.now().toString(),
            title,
            body,
            type,
          })
        }
      />

      <DriverDetailModal
        visible={Boolean(selectedDriver)}
        driver={selectedDriver}
        onClose={() => setSelectedDriver(null)}
      />

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onLogout={onLogout}
        role="OWNER"
      />

      <FleetVehiclesModal
        visible={vehiclesModalVisible}
        onClose={() => {
          setVehiclesModalVisible(false);
          void refreshFleet();
        }}
        onVehicleUpdated={() => {
          void refreshFleet();
        }}
      />

      <FleetExpensesModal
        visible={expensesModalVisible}
        onClose={() => setExpensesModalVisible(false)}
        onExpenseUpdated={() => {
          void refreshFleet();
        }}
      />

      <AddDriverModal
        visible={addDriverModalVisible}
        onClose={() => {
          setAddDriverModalVisible(false);
          void refreshFleet();
        }}
        onDriverAdded={() => {
          void refreshFleet();
        }}
        onShowNotification={(title, body, type) =>
          setNotification({
            id: Date.now().toString(),
            title,
            body,
            type,
          })
        }
      />
    </View>
  );
}
