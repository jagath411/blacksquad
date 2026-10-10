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
          label="FLEET OPERATIONS"
          icon="business"
          iconColor="#F59E0B"
          onProfile={() => setProfileVisible(true)}
          extra={
            <Pressable
              accessibilityRole="button"
              style={[s.profileAvatarBtn, { backgroundColor: '#10B981', borderColor: '#059669', width: 'auto', paddingHorizontal: 12 }]}
              onPress={() => setAnalyticsVisible(true)}
            >
              <Icon name="stats-chart" size={15} color="#07100D" />
              <Text style={{ color: '#07100D', fontSize: 12, fontWeight: '900', marginLeft: 4 }}>Revenue</Text>
            </Pressable>
          }
        />
        <RecenterButton isLocating={isLocating} onPress={() => void locate(true)} />
      </View>

      <View style={s.ownerSheet}>
        <View style={s.sheetHandle} />

        {/* Fleet Revenue & Analytics Banner Action */}
        <Pressable
          style={s.ownerAnalyticsBanner}
          onPress={() => setAnalyticsVisible(true)}
        >
          <View style={s.analyticsBannerIconBox}>
            <Icon name="trending-up" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.analyticsBannerTitle}>Fleet Financial Analytics</Text>
            <Text style={s.analyticsBannerSub}>Weekly earnings charts, net profits & driver payouts</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#10B981" />
        </Pressable>

        {/* Quick Management Actions Grid (Vehicles & Expenses) */}
        <View style={s.ownerQuickGrid}>
          <Pressable
            style={s.ownerQuickCard}
            onPress={() => setVehiclesModalVisible(true)}
          >
            <View style={[s.ownerQuickIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Icon name="car-sport" size={16} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ownerQuickCardTitle}>Vehicle Registry</Text>
              <Text style={s.ownerQuickCardSub}>Add & assign cars/vans</Text>
            </View>
          </Pressable>

          <Pressable
            style={s.ownerQuickCard}
            onPress={() => setExpensesModalVisible(true)}
          >
            <View style={[s.ownerQuickIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Icon name="receipt" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ownerQuickCardTitle}>Fleet Expenses</Text>
              <Text style={s.ownerQuickCardSub}>Fuel, repairs & tolls</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.ownerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.ownerTitle}>Active Vehicle Fleet</Text>
            <Text style={s.ownerSub}>
              {drivers && drivers.length > 0
                ? `${drivers.filter((d) => d.state === 'Online').length} Online • ${drivers.length} Registered Drivers`
                : fleetLoading ? 'Loading fleet…' : 'No drivers yet'}
            </Text>
          </View>
          <Pressable
            style={s.addDriverBtn}
            onPress={() => setAddDriverModalVisible(true)}
          >
            <Icon name="person-add" size={14} color="#07100D" />
            <Text style={s.addDriverBtnText}>+ Add Driver</Text>
          </Pressable>
        </View>

        <ScrollView style={s.fleetScroll} showsVerticalScrollIndicator={false}>
          {drivers && drivers.length > 0 ? (
            drivers.map((driver) => (
              <Pressable
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
                      📞 {driver.phone}
                    </Text>
                  ) : null}
                </View>

                <View style={s.fleetActionRow}>
                  {driver.phone ? (
                    <Pressable
                      style={s.fleetCallBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        callNumber(driver.phone);
                      }}
                    >
                      <Icon name="call" size={14} color="#00D084" />
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={s.fleetFocusBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      focusDriver(driver);
                    }}
                  >
                    <Icon name="navigate" size={14} color="#38BDF8" />
                  </Pressable>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={s.emptyFleet}>
              <Icon name="car-sport-outline" size={36} color="#64748B" />
              <Text style={s.emptyFleetText}>No drivers found in your fleet registry</Text>
              <Pressable
                style={s.emptyFleetAddBtn}
                onPress={() => setAddDriverModalVisible(true)}
              >
                <Text style={s.emptyFleetAddBtnText}>+ Onboard First Fleet Driver</Text>
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
