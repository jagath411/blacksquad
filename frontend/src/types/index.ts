export type UserRole = 'OWNER' | 'DRIVER' | 'CUSTOMER';

export type RootStackParamList = {
  Welcome: undefined;
  Role: undefined;
  Login: { role: UserRole };
  Home: { role: UserRole };
  ForgotPassword: undefined;
  ResetPassword: { email: string; token?: string };
};

export interface HealthResponse {
  success: boolean;
  message: string;
  apiStatus: string;
  database: { status: string };
}

export type BookingStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'TRIP_STARTED'
  | 'TRIP_COMPLETED'
  | 'CANCELLED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  pushToken?: string;
}

export interface DriverLiveLocation {
  bookingId?: string;
  driverId: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  etaMinutes?: number;
  distanceKm?: number;
  timestamp: number;
}

export interface SavedPlace {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: 'home' | 'work' | 'favorite';
}

export interface BookingData {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  } | string;
  driverId?: {
    _id: string;
    userId: {
      _id: string;
      name: string;
      email: string;
      phoneNumber?: string;
    };
    licenseNumber?: string;
    vehicleId?: {
      _id: string;
      registrationNumber: string;
      vehicleType: string;
      model?: string;
    };
  } | any;
  vehicleId?: {
    _id: string;
    registrationNumber: string;
    vehicleType: string;
    model?: string;
  } | any;
  pickupAddress: string;
  dropAddress: string;
  pickupLocation: { type: string; coordinates: [number, number] }; // [lng, lat]
  dropLocation: { type: string; coordinates: [number, number] }; // [lng, lat]
  serviceTier: string;
  status: BookingStatus;
  fare: number;
  distanceKm?: number;
  startOtp?: string;
  driverRating?: number;
  riderRating?: number;
  cancellationReason?: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updatedAt: string;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}
