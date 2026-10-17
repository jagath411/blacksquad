import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { fonts } from '../../theme/fonts';

/** Styles shared by the customer, driver and owner home screens. */
export const s = StyleSheet.create<{
  placeChip: ViewStyle;
  placeChipText: TextStyle;
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
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DBE2' },
  placeChipText: { color: '#1D232B', fontSize: 15, fontFamily: fonts.w600 },
  container: {
    flex: 1,
    backgroundColor: '#F3F5F7',
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
  brandBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#1D232B', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  brandBadgeText: { color: '#1D232B', fontSize: 15, fontFamily: fonts.w700 },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#1D232B', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  recenterFab: { position: 'absolute', right: 16, bottom: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#1D232B', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  floatingEtaPill: { position: 'absolute', top: Platform.OS === 'ios' ? 108 : 92, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1D232B', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, zIndex: 15, shadowColor: '#1D232B', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  floatingEtaContent: {
    gap: 2,
  },
  floatingEtaText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.w600 },
  floatingEtaSub: { color: '#C9D1DA', fontSize: 14, fontFamily: fonts.w400, marginTop: 2 },
  bookingSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, shadowColor: '#1D232B', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  activeRideSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, shadowColor: '#1D232B', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  driverControlSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, shadowColor: '#1D232B', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  ownerSheet: { height: '46%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, shadowColor: '#1D232B', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D5DBE2',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F5F7', borderRadius: 14, borderWidth: 1, borderColor: '#D5DBE2', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  searchPlaceholder: { flex: 1, color: '#1D232B', fontSize: 18, fontFamily: fonts.w600 },
  searchNowBtn: {
    backgroundColor: '#1F3FB8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  searchNowText: {
    color: '#1D232B',
    fontSize: 10,
    fontFamily: fonts.w700,
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
  sheetTitle: { color: '#1D232B', fontSize: 22, fontFamily: fonts.w700 },
  inputsContainer: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#9AA4B0', paddingHorizontal: 14, paddingVertical: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickupPointDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D232B' },
  dropPointSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#1F3FB8', borderWidth: 2, borderColor: '#1D232B' },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(29, 35, 43, 0.06)',
    marginVertical: 10,
    marginLeft: 18,
  },
  addressInput: { flex: 1, color: '#1D232B', fontSize: 17, fontFamily: fonts.w500, paddingVertical: 10 },
  tiersHeading: { color: '#5B6573', fontSize: 14, fontFamily: fonts.w600, marginTop: 18, marginBottom: 10 },
  tiersList: {
    gap: 10,
    marginBottom: 16,
  },
  tierCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#D5DBE2', gap: 14 },
  tierCardActive: { borderColor: '#1D232B', backgroundColor: '#EEF2FD' },
  tierIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E9EDF1', alignItems: 'center', justifyContent: 'center' },
  tierInfo: {
    flex: 1,
  },
  tierName: { color: '#1D232B', fontSize: 17, fontFamily: fonts.w700 },
  tierDesc: { color: '#5B6573', fontSize: 14, fontFamily: fonts.w400, marginTop: 2 },
  tierPricing: {
    alignItems: 'flex-end',
  },
  tierPrice: { color: '#1D232B', fontSize: 24, fontFamily: fonts.figuresBold },
  tierEta: {
    color: '#1E8E5A',
    fontSize: 10,
    fontFamily: fonts.w600,
    marginTop: 2,
  },
  bookBtnContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, marginBottom: 14 },
  driverAvatarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E9EDF1', alignItems: 'center', justifyContent: 'center' },
  driverMeta: {
    flex: 1,
  },
  driverName: { color: '#1D232B', fontSize: 20, fontFamily: fonts.w700 },
  driverVehicle: { color: '#5B6573', fontSize: 15, fontFamily: fonts.w400, marginTop: 2 },
  otpBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2, borderRadius: 6, alignItems: 'center', borderWidth: 2.5, borderColor: '#1D232B' },
  otpLabel: { color: '#5B6573', fontSize: 11, fontFamily: fonts.w600 },
  otpCode: { color: '#1D232B', fontSize: 30, lineHeight: 32, fontFamily: fonts.figuresBold, letterSpacing: 3 },
  tripStatusBox: { paddingVertical: 6, marginBottom: 16 },
  statusStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLine: { flex: 1, height: 3, marginHorizontal: 8, borderRadius: 2 },
  statusLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: { color: '#1D232B', fontSize: 14, fontFamily: fonts.w600 },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F3FB8', paddingVertical: 15, borderRadius: 14, gap: 8 },
  callBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.w600 },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 15, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#D5DBE2' },
  cancelBtnText: { color: '#C8372D', fontSize: 16, fontFamily: fonts.w600 },
  dutyContainer: {
    gap: 14,
  },
  dutyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dutyTitle: { color: '#1D232B', fontSize: 26, fontFamily: fonts.w700 },
  dutySub: { color: '#5B6573', fontSize: 15, lineHeight: 21, fontFamily: fonts.w400, marginTop: 4 },
  dutyStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EDF1',
    borderRadius: 12,
    padding: 12,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: { color: '#5B6573', fontSize: 13, fontFamily: fonts.w500 },
  telemetryValue: { color: '#1D232B', fontSize: 22, fontFamily: fonts.figuresBold, marginTop: 2 },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(29, 35, 43, 0.08)',
  },
  toggleDutyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 60, borderRadius: 16, gap: 10 },
  toggleDutyBtnOnline: { backgroundColor: '#1F3FB8' },
  toggleDutyBtnOffline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#1D232B' },
  toggleDutyBtnText: { color: '#1D232B', fontSize: 18, fontFamily: fonts.w700 },
  incomingOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    zIndex: 30,
  },
  incomingCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderTopWidth: 6, borderTopColor: '#1F3FB8', shadowColor: '#1D232B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 16 },
  incomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  incomingBadge: { alignSelf: 'flex-start' },
  incomingBadgeText: { color: '#1D232B', fontSize: 16, fontFamily: fonts.w700 },
  incomingTimerText: {
    color: '#B7791F',
    fontSize: 14,
    fontFamily: fonts.w700,
  },
  incomingFare: { color: '#1D232B', fontSize: 44, lineHeight: 48, fontFamily: fonts.figuresBold },
  incomingTier: {
    color: '#5B6573',
    fontSize: 12, fontFamily: fonts.w400,
    marginBottom: 12,
  },
  incomingLocations: {
    backgroundColor: '#E9EDF1',
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
    color: '#1D232B',
    fontSize: 12,
    fontFamily: fonts.w600,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DBE2', minHeight: 56, borderRadius: 14 },
  declineBtnText: { color: '#1D232B', fontSize: 16, fontFamily: fonts.w600 },
  acceptBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F3FB8', minHeight: 56, borderRadius: 14 },
  acceptBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.w700 },
  activeTripContent: {
    gap: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripKicker: { color: '#5B6573', fontSize: 15, fontFamily: fonts.w500 },
  tripFare: { color: '#1D232B', fontSize: 34, lineHeight: 38, fontFamily: fonts.figuresBold },
  statusPill: {
    backgroundColor: 'rgba(31, 63, 184, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    color: '#1E8E5A',
    fontSize: 11,
    fontFamily: fonts.w700,
  },
  tripLocations: {
    backgroundColor: '#E9EDF1',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  actionPrimaryBtn: { backgroundColor: '#1F3FB8', minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  actionPrimaryText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.w700 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(29, 35, 43, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.10)',
    alignItems: 'center',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpModalTitle: {
    color: '#1D232B',
    fontSize: 18,
    fontFamily: fonts.w700,
    marginTop: 8,
  },
  otpModalSub: {
    color: '#5B6573',
    fontSize: 12, fontFamily: fonts.w400,
    textAlign: 'center',
    marginTop: 4,
  },
  otpInputBox: {
    width: 180,
    height: 52,
    backgroundColor: '#E9EDF1',
    borderRadius: 12,
    color: '#1E8E5A',
    fontSize: 24,
    fontFamily: fonts.w700,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#172F8A',
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
    backgroundColor: '#E9EDF1',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpCancelText: {
    color: '#5B6573',
    fontSize: 13,
    fontFamily: fonts.w700,
  },
  otpSubmitBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F3FB8',
    paddingVertical: 12,
    borderRadius: 12,
  },
  otpSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.w700,
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.10)',
  },
  ratingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingTitle: {
    color: '#1D232B',
    fontSize: 18,
    fontFamily: fonts.w700,
    marginTop: 8,
  },
  ratingSub: {
    color: '#5B6573',
    fontSize: 12, fontFamily: fonts.w400,
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
    color: '#7A8592',
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: fonts.w700,
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
    backgroundColor: '#E9EDF1',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tipBtnActive: {
    backgroundColor: 'rgba(31, 63, 184, 0.13)',
    borderColor: '#172F8A',
  },
  tipText: {
    color: '#5B6573',
    fontSize: 12,
    fontFamily: fonts.w700,
  },
  tipTextActive: {
    color: '#1E8E5A',
  },
  ownerAnalyticsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(30, 142, 90, 0.40)',
    marginBottom: 10,
  },
  analyticsBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 142, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsBannerTitle: {
    color: '#1D232B',
    fontSize: 14,
    fontFamily: fonts.w700,
  },
  analyticsBannerSub: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 35, 43, 0.08)',
  },
  ownerQuickIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerQuickCardTitle: {
    color: '#1D232B',
    fontSize: 12,
    fontFamily: fonts.w700,
  },
  ownerQuickCardSub: {
    color: '#7A8592',
    fontSize: 9,
    fontFamily: fonts.w600,
    marginTop: 1,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ownerTitle: {
    color: '#1D232B',
    fontSize: 17,
    fontFamily: fonts.w700,
  },
  ownerSub: {
    color: '#5B6573',
    fontSize: 12, fontFamily: fonts.w400,
    marginTop: 2,
  },
  addDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F3FB8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.w700,
  },
  fleetScroll: {
    flex: 1,
  },
  fleetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EDF1',
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
    color: '#1D232B',
    fontSize: 13,
    fontFamily: fonts.w700,
  },
  fleetVehicle: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
    marginTop: 2,
  },
  fleetPhoneText: {
    color: '#1E8E5A',
    fontSize: 11,
    fontFamily: fonts.w600,
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
    backgroundColor: 'rgba(31, 63, 184, 0.13)',
    borderWidth: 1,
    borderColor: '#172F8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetFocusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(36, 87, 214, 0.15)',
    borderWidth: 1,
    borderColor: '#2457D6',
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
    color: '#5B6573',
    fontSize: 13,
    fontFamily: fonts.w600,
  },
  emptyFleetAddBtn: {
    backgroundColor: '#1F3FB8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyFleetAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.w700,
  },
});
