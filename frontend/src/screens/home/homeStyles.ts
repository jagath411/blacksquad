import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/** Styles shared by the customer, driver and owner home screens. */
export const s = StyleSheet.create<{
  container: ViewStyle;
  mapWrapper: ViewStyle;
  mapFrame: ViewStyle;
  mapTopRow: ViewStyle;
  brandBadge: ViewStyle;
  brandBadgeText: TextStyle;
  headerBtnGroup: ViewStyle;
  profileAvatarBtn: ViewStyle;
  recenterFab: ViewStyle;
  floatingEtaPill: ViewStyle;
  floatingEtaContent: ViewStyle;
  floatingEtaText: TextStyle;
  floatingEtaSub: TextStyle;
  bookingSheet: ViewStyle;
  activeRideSheet: ViewStyle;
  driverControlSheet: ViewStyle;
  ownerSheet: ViewStyle;
  ownerAnalyticsBanner: ViewStyle;
  analyticsBannerIconBox: ViewStyle;
  analyticsBannerTitle: TextStyle;
  analyticsBannerSub: TextStyle;
  ownerQuickGrid: ViewStyle;
  ownerQuickCard: ViewStyle;
  ownerQuickIconBox: ViewStyle;
  ownerQuickCardTitle: TextStyle;
  ownerQuickCardSub: TextStyle;
  sheetHandle: ViewStyle;
  searchBar: ViewStyle;
  searchPlaceholder: TextStyle;
  searchNowBtn: ViewStyle;
  searchNowText: TextStyle;
  bookingFormScroll: ViewStyle;
  bookingFormHeader: ViewStyle;
  sheetTitle: TextStyle;
  inputsContainer: ViewStyle;
  inputRow: ViewStyle;
  pickupPointDot: ViewStyle;
  dropPointSquare: ViewStyle;
  inputDivider: ViewStyle;
  addressInput: TextStyle;
  tiersHeading: TextStyle;
  tiersList: ViewStyle;
  tierCard: ViewStyle;
  tierCardActive: ViewStyle;
  tierIconBox: ViewStyle;
  tierInfo: ViewStyle;
  tierName: TextStyle;
  tierDesc: TextStyle;
  tierPricing: ViewStyle;
  tierPrice: TextStyle;
  tierEta: TextStyle;
  bookBtnContainer: ViewStyle;
  driverCard: ViewStyle;
  driverAvatarBox: ViewStyle;
  driverMeta: ViewStyle;
  driverName: TextStyle;
  driverVehicle: TextStyle;
  otpBadge: ViewStyle;
  otpLabel: TextStyle;
  otpCode: TextStyle;
  tripStatusBox: ViewStyle;
  statusStepRow: ViewStyle;
  statusDot: ViewStyle;
  statusLine: ViewStyle;
  statusLabelsRow: ViewStyle;
  stepLabel: TextStyle;
  sheetActions: ViewStyle;
  callBtn: ViewStyle;
  callBtnText: TextStyle;
  cancelBtn: ViewStyle;
  cancelBtnText: TextStyle;
  dutyContainer: ViewStyle;
  dutyHeader: ViewStyle;
  dutyTitle: TextStyle;
  dutySub: TextStyle;
  dutyStatusDot: ViewStyle;
  telemetryCard: ViewStyle;
  telemetryItem: ViewStyle;
  telemetryLabel: TextStyle;
  telemetryValue: TextStyle;
  telemetryDivider: ViewStyle;
  toggleDutyBtn: ViewStyle;
  toggleDutyBtnOnline: ViewStyle;
  toggleDutyBtnOffline: ViewStyle;
  toggleDutyBtnText: TextStyle;
  incomingOverlay: ViewStyle;
  incomingCard: ViewStyle;
  incomingTop: ViewStyle;
  incomingBadge: ViewStyle;
  incomingBadgeText: TextStyle;
  incomingTimerText: TextStyle;
  incomingFare: TextStyle;
  incomingTier: TextStyle;
  incomingLocations: ViewStyle;
  locRow: ViewStyle;
  locText: TextStyle;
  incomingActions: ViewStyle;
  declineBtn: ViewStyle;
  declineBtnText: TextStyle;
  acceptBtn: ViewStyle;
  acceptBtnText: TextStyle;
  activeTripContent: ViewStyle;
  tripHeader: ViewStyle;
  tripKicker: TextStyle;
  tripFare: TextStyle;
  statusPill: ViewStyle;
  statusPillText: TextStyle;
  tripLocations: ViewStyle;
  actionPrimaryBtn: ViewStyle;
  actionPrimaryText: TextStyle;
  modalOverlay: ViewStyle;
  otpModalCard: ViewStyle;
  otpHeader: ViewStyle;
  otpModalTitle: TextStyle;
  otpModalSub: TextStyle;
  otpInputBox: TextStyle;
  otpActions: ViewStyle;
  otpCancelBtn: ViewStyle;
  otpCancelText: TextStyle;
  otpSubmitBtn: ViewStyle;
  otpSubmitText: TextStyle;
  ratingCard: ViewStyle;
  ratingHeader: ViewStyle;
  ratingTitle: TextStyle;
  ratingSub: TextStyle;
  starsRow: ViewStyle;
  starBtn: ViewStyle;
  tipHeading: TextStyle;
  tipsRow: ViewStyle;
  tipBtn: ViewStyle;
  tipBtnActive: ViewStyle;
  tipText: TextStyle;
  tipTextActive: TextStyle;
  ownerHeader: ViewStyle;
  ownerTitle: TextStyle;
  ownerSub: TextStyle;
  addDriverBtn: ViewStyle;
  addDriverBtnText: TextStyle;
  fleetScroll: ViewStyle;
  fleetCard: ViewStyle;
  fleetAvatar: ViewStyle;
  fleetMeta: ViewStyle;
  fleetName: TextStyle;
  fleetVehicle: TextStyle;
  fleetPhoneText: TextStyle;
  fleetActionRow: ViewStyle;
  fleetCallBtn: ViewStyle;
  fleetFocusBtn: ViewStyle;
  fleetStatusGroup?: ViewStyle;
  emptyFleet: ViewStyle;
  emptyFleetText: TextStyle;
  emptyFleetAddBtn: ViewStyle;
  emptyFleetAddBtnText: TextStyle;
}>({
  container: {
    flex: 1,
    backgroundColor: '#07100D',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  mapFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mapTopRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  recenterFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00D084',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    zIndex: 50,
  },
  floatingEtaPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 88,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.3)',
    zIndex: 15,
  },
  floatingEtaContent: {
    gap: 2,
  },
  floatingEtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingEtaSub: {
    color: '#00D084',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 240,
  },
  bookingSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeRideSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  driverControlSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ownerSheet: {
    height: '42%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  searchNowBtn: {
    backgroundColor: '#00D084',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  searchNowText: {
    color: '#07100D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bookingFormScroll: {
    maxHeight: 380,
  },
  bookingFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  inputsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickupPointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D084',
  },
  dropPointSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 10,
    marginLeft: 18,
  },
  addressInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  tiersHeading: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 10,
  },
  tiersList: {
    gap: 10,
    marginBottom: 16,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  tierCardActive: {
    borderColor: '#00D084',
    backgroundColor: '#132A22',
  },
  tierIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  tierDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  tierPricing: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  tierEta: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  bookBtnContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  driverAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  driverVehicle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  otpBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D084',
  },
  otpLabel: {
    color: '#00D084',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otpCode: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tripStatusBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  statusStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  statusLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  dutyContainer: {
    gap: 14,
  },
  dutyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dutyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  dutySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  dutyStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  telemetryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleDutyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  toggleDutyBtnOnline: {
    backgroundColor: '#00D084',
  },
  toggleDutyBtnOffline: {
    backgroundColor: '#EF4444',
  },
  toggleDutyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  incomingOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    zIndex: 30,
  },
  incomingCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#00D084',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  incomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  incomingBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  incomingBadgeText: {
    color: '#00D084',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  incomingTimerText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
  },
  incomingFare: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  incomingTier: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
  },
  incomingLocations: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
  },
  declineBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D084',
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptBtnText: {
    color: '#07100D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeTripContent: {
    gap: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripKicker: {
    color: '#00D084',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  tripFare: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statusPill: {
    backgroundColor: 'rgba(0, 208, 132, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    color: '#00D084',
    fontSize: 11,
    fontWeight: '800',
  },
  tripLocations: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  actionPrimaryBtn: {
    backgroundColor: '#00D084',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionPrimaryText: {
    color: '#07100D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  otpModalSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  otpInputBox: {
    width: 180,
    height: 52,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    color: '#00D084',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#00D084',
    marginBottom: 20,
  },
  otpActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  otpCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  otpSubmitBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D084',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpSubmitText: {
    color: '#07100D',
    fontSize: 13,
    fontWeight: '900',
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  ratingSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  starBtn: {
    padding: 4,
  },
  tipHeading: {
    color: '#64748B',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  tipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tipBtnActive: {
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderColor: '#00D084',
  },
  tipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  tipTextActive: {
    color: '#00D084',
  },
  ownerAnalyticsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginBottom: 10,
  },
  analyticsBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsBannerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  analyticsBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  ownerQuickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ownerQuickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ownerQuickIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerQuickCardTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '800',
  },
  ownerQuickCardSub: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ownerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  ownerSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  addDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00D084',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addDriverBtnText: {
    color: '#07100D',
    fontSize: 12,
    fontWeight: '900',
  },
  fleetScroll: {
    flex: 1,
  },
  fleetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  fleetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetMeta: {
    flex: 1,
  },
  fleetName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  fleetVehicle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  fleetPhoneText: {
    color: '#00D084',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  fleetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fleetCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    borderWidth: 1,
    borderColor: '#00D084',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetFocusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFleet: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyFleetText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyFleetAddBtn: {
    backgroundColor: '#00D084',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyFleetAddBtnText: {
    color: '#07100D',
    fontSize: 13,
    fontWeight: '900',
  },
});
