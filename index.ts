export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

export type CustomerStatus = 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';

export type DriverStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'BLOCKED' | 'EXPIRED';

export type RideStatus =
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'DRIVER_ARRIVED'
  | 'RIDE_STARTED'
  | 'ON_TRIP'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'UPI' | 'WALLET' | 'CARD';

export type PaymentStatus = 'PAYMENT_PENDING' | 'PAYMENT_SUCCESSFUL' | 'PAYMENT_FAILED';

export type RideOptionType = 'BIKE' | 'AUTO' | 'MINI' | 'SEDAN' | 'XL';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  address?: string;
  heading?: number;
  speed?: number;
  updatedAt?: string;
}

export interface Customer {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  passwordHash?: string;
  status: CustomerStatus;
  rating?: number;
  totalRides: number;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  driverId: string;
  name: string;
  phone: string;
  email?: string;
  passwordHash?: string;
  vehicleType: RideOptionType;
  vehicleModel: string;
  vehicleNumber: string;
  licenseNumber?: string;
  status: DriverStatus;
  isOnline: boolean;
  isBusy: boolean;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  currentLocation?: LocationCoordinates;
  currentRideId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ride {
  rideId: string;
  customerId: string;
  driverId: string | null;
  customerName: string;
  customerPhone: string;
  driverName: string | null;
  driverPhone: string | null;
  vehicleModel: string | null;
  vehicleNumber: string | null;
  vehicleType: RideOptionType;
  pickup: string;
  drop: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  distanceKm: number;
  durationMins?: number;
  fare: number;
  rideOption: RideOptionType;
  otp: string;
  otpVerified: boolean;
  status: RideStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Payment {
  paymentId: string;
  rideId: string;
  customerId: string;
  driverId?: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;
  upiQrUrl?: string;
  collectedByDriver: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  transactionId: string;
  paymentId?: string;
  rideId?: string;
  type: 'RIDE_PAYMENT' | 'DRIVER_PAYOUT' | 'COMMISSION' | 'REFUND';
  amount: number;
  driverEarnings?: number;
  platformFee?: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  description?: string;
  createdAt: string;
}

export interface ServiceArea {
  areaId: string;
  name: string;
  city: string;
  state: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  baseFare: number;
  perKmRate: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUser {
  adminId: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN';
  createdAt: string;
}

export interface AppSettings {
  demoMode: boolean;
  allowDemoOtp: boolean; // 1234 allowed ONLY if demoMode is true
  platformCommissionPercent: number;
  surgeMultiplier: number;
  upiMerchantId: string;
  upiMerchantName: string;
  autoAssignDrivers: boolean;
}

export interface AuthJWTPayload {
  userId: string;
  role: UserRole;
  phone?: string;
  name: string;
}

// WebSocket Event Types
export type WebSocketEventType =
  // Customer events
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'DRIVER_ARRIVED'
  | 'RIDE_STARTED'
  | 'ON_TRIP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAYMENT_SUCCESSFUL'
  | 'DRIVER_LOCATION_UPDATE'
  // Driver events
  | 'NEW_RIDE_REQUEST'
  | 'RIDE_ACCEPTED'
  | 'RIDE_CANCELLED_BY_CUSTOMER'
  | 'PAYMENT_RECEIVED'
  // Admin & system events
  | 'STATS_UPDATED'
  | 'DRIVER_ONLINE_STATUS'
  | 'LIVE_RIDE_UPDATE';

export interface WebSocketMessage<T = unknown> {
  event: WebSocketEventType;
  payload: T;
  timestamp: string;
  recipientId?: string;
}
