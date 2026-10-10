import { BookingModel } from '../models/Booking';

/** Fields of a driver profile that are safe to show on a booking. */
const DRIVER_PUBLIC_FIELDS = 'userId vehicleId availabilityStatus';

export function findBookingForView(bookingId: unknown) {
  return BookingModel.findById(bookingId)
    .populate('customerId', 'name phoneNumber')
    .populate({
      path: 'driverId',
      select: DRIVER_PUBLIC_FIELDS,
      populate: { path: 'userId', select: 'name phoneNumber' },
    })
    .populate('vehicleId', 'registrationNumber vehicleType model')
    .lean();
}

/** The trip-start PIN belongs to the customer only; drivers must ask for it. */
export function withoutStartPin<T extends object | null>(booking: T): T {
  if (!booking) return booking;
  const copy = { ...(booking as Record<string, unknown>) };
  delete copy.startOtp;
  return copy as T;
}
