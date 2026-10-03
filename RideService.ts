import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db.ts';
import { fareService } from './FareService.ts';
import { locationService } from './LocationService.ts';
import { socketManager } from '../websocket/socketManager.ts';
import { Ride, RideOptionType, PaymentMethod } from '../types/index.ts';

export class RideService {
  /**
   * Create a new Ride Request
   */
  public async createRide(data: {
    customerId: string;
    pickup: string;
    drop: string;
    pickupLat: number;
    pickupLng: number;
    dropLat: number;
    dropLng: number;
    rideOption: RideOptionType;
    paymentMethod?: PaymentMethod;
  }): Promise<Ride> {
    const customer = db.customers.get(data.customerId);
    if (!customer) {
      throw new Error(`Customer ${data.customerId} not found.`);
    }

    if (customer.status === 'BLOCKED') {
      throw new Error('Your account has been restricted. You cannot book rides.');
    }

    const distanceKm = fareService.calculateDistance(
      data.pickupLat,
      data.pickupLng,
      data.dropLat,
      data.dropLng
    );

    const { fare } = fareService.calculateFare(
      distanceKm,
      data.rideOption,
      db.settings.surgeMultiplier
    );

    // Generate unique 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const rideId = `RIDE-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const newRide: Ride = {
      rideId,
      customerId: customer.customerId,
      driverId: null,
      customerName: customer.name,
      customerPhone: customer.phone,
      driverName: null,
      driverPhone: null,
      vehicleModel: null,
      vehicleNumber: null,
      vehicleType: data.rideOption,
      pickup: data.pickup,
      drop: data.drop,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropLat: data.dropLat,
      dropLng: data.dropLng,
      distanceKm,
      durationMins: Math.max(5, Math.round(distanceKm * 2.5)),
      fare,
      rideOption: data.rideOption,
      otp,
      otpVerified: false,
      status: 'SEARCHING',
      paymentMethod: data.paymentMethod || 'CASH',
      paymentStatus: 'PAYMENT_PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.rides.set(rideId, newRide);

    // Broadcast new ride request to all available online drivers with complete ride object
    socketManager.broadcastToAvailableDrivers('NEW_RIDE_REQUEST', {
      ...newRide,
      ride: newRide,
      rideId: newRide.rideId,
      pickup: newRide.pickup,
      drop: newRide.drop,
      fare: newRide.fare,
      distanceKm: newRide.distanceKm,
      rideOption: newRide.rideOption,
    });

    // Notify admins
    socketManager.emitToAdmins('LIVE_RIDE_UPDATE', { ride: newRide });

    // Auto-assignment if enabled or find nearest driver
    const nearby = locationService.findNearbyDrivers(data.pickupLat, data.pickupLng, data.rideOption, 20);
    if (nearby.length > 0 && db.settings.autoAssignDrivers) {
      await this.assignDriver(rideId, nearby[0].driverId);
    }

    return newRide;
  }

  /**
   * Driver accepts a ride request
   */
  public async acceptRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = db.rides.get(rideId);
    if (!ride) {
      throw new Error(`Ride ${rideId} not found.`);
    }

    if (ride.status !== 'SEARCHING') {
      throw new Error(`Ride is no longer available (current status: ${ride.status}).`);
    }

    const driver = db.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found.`);
    }

    if (driver.status === 'BLOCKED') {
      throw new Error('Blocked driver cannot accept rides.');
    }

    if (driver.isBusy) {
      throw new Error('Driver is already on another active ride.');
    }

    // Update Driver state
    driver.isBusy = true;
    driver.currentRideId = rideId;
    driver.updatedAt = new Date().toISOString();
    db.drivers.set(driverId, driver);

    // Update Ride state
    ride.driverId = driver.driverId;
    ride.driverName = driver.name;
    ride.driverPhone = driver.phone;
    ride.vehicleModel = driver.vehicleModel;
    ride.vehicleNumber = driver.vehicleNumber;
    ride.status = 'DRIVER_ASSIGNED';
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    // Real-time notification to Customer & Driver
    socketManager.emitToCustomer(ride.customerId, 'DRIVER_ASSIGNED', {
      rideId,
      driver: {
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone,
        vehicleModel: driver.vehicleModel,
        vehicleNumber: driver.vehicleNumber,
        rating: driver.rating,
        currentLocation: driver.currentLocation,
      },
      status: 'DRIVER_ASSIGNED',
    });

    socketManager.emitToDriver(driver.driverId, 'RIDE_ACCEPTED', {
      ride,
    });

    socketManager.emitRideUpdate(rideId, 'DRIVER_ASSIGNED', { ride });

    return ride;
  }

  /**
   * Driver Marks Arriving / In Transit to Pickup
   */
  public async markDriverArriving(rideId: string, driverId: string): Promise<Ride> {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);
    if (ride.driverId !== driverId) throw new Error('Unauthorized driver for this ride.');

    ride.status = 'DRIVER_ARRIVING';
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    socketManager.emitToCustomer(ride.customerId, 'DRIVER_ARRIVING', { rideId, status: 'DRIVER_ARRIVING' });
    socketManager.emitRideUpdate(rideId, 'DRIVER_ARRIVING', { ride });
    return ride;
  }

  /**
   * Driver Marks Arrived at Pickup Location
   */
  public async markDriverArrived(rideId: string, driverId: string): Promise<Ride> {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);
    if (ride.driverId !== driverId) throw new Error('Unauthorized driver for this ride.');

    ride.status = 'DRIVER_ARRIVED';
    ride.arrivedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    // Customer gets DRIVER_ARRIVED event with OTP confirmation
    socketManager.emitToCustomer(ride.customerId, 'DRIVER_ARRIVED', {
      rideId,
      status: 'DRIVER_ARRIVED',
      otp: ride.otp,
      message: 'Driver has arrived at your pickup location. Please share your OTP with the driver.',
    });

    socketManager.emitToDriver(driverId, 'DRIVER_ARRIVED', {
      rideId,
      status: 'DRIVER_ARRIVED',
    });

    socketManager.emitRideUpdate(rideId, 'DRIVER_ARRIVED', { ride });
    return ride;
  }

  /**
   * Driver verifies customer 4-digit OTP
   */
  public async verifyOtp(rideId: string, driverId: string, enteredOtp: string): Promise<{ success: boolean; ride: Ride }> {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);
    if (ride.driverId !== driverId) throw new Error('Unauthorized driver for this ride.');

    const cleanEnteredOtp = (enteredOtp || '').trim();
    const isDemoOtpAllowed = db.settings.demoMode && cleanEnteredOtp === '1234';
    const isRealOtpValid = cleanEnteredOtp === ride.otp;

    if (!isRealOtpValid && !isDemoOtpAllowed) {
      throw new Error('Invalid OTP! Please ask the customer for the correct 4-digit OTP shown in their app.');
    }

    ride.otpVerified = true;
    ride.status = 'RIDE_STARTED';
    ride.startedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    // Notify Customer & Driver in real time
    socketManager.emitToCustomer(ride.customerId, 'RIDE_STARTED', {
      rideId,
      status: 'RIDE_STARTED',
      startedAt: ride.startedAt,
    });

    socketManager.emitToDriver(driverId, 'RIDE_STARTED', {
      rideId,
      status: 'RIDE_STARTED',
    });

    socketManager.emitRideUpdate(rideId, 'RIDE_STARTED', { ride });

    return { success: true, ride };
  }

  /**
   * Complete Ride at destination
   */
  public async completeRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);
    if (ride.driverId !== driverId) throw new Error('Unauthorized driver for this ride.');

    ride.status = 'COMPLETED';
    ride.completedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    // Update driver earnings & stats
    const driver = db.drivers.get(driverId);
    if (driver) {
      const commission = Math.round(ride.fare * (db.settings.platformCommissionPercent / 100));
      const driverEarn = ride.fare - commission;
      driver.totalEarnings = (driver.totalEarnings || 0) + driverEarn;
      driver.totalRides = (driver.totalRides || 0) + 1;
      driver.isBusy = false;
      driver.currentRideId = null;
      driver.updatedAt = new Date().toISOString();
      db.drivers.set(driverId, driver);
    }

    // Update customer total rides
    const customer = db.customers.get(ride.customerId);
    if (customer) {
      customer.totalRides = (customer.totalRides || 0) + 1;
      customer.updatedAt = new Date().toISOString();
      db.customers.set(customer.customerId, customer);
    }

    // Emit COMPLETED event
    socketManager.emitToCustomer(ride.customerId, 'COMPLETED', {
      rideId,
      status: 'COMPLETED',
      fare: ride.fare,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
    });

    socketManager.emitToDriver(driverId, 'COMPLETED', {
      rideId,
      status: 'COMPLETED',
      fare: ride.fare,
    });

    socketManager.emitRideUpdate(rideId, 'COMPLETED', { ride });

    return ride;
  }

  /**
   * Cancel Ride
   */
  public async cancelRide(rideId: string, cancelledBy: 'CUSTOMER' | 'DRIVER' | 'ADMIN', reason?: string): Promise<Ride> {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);

    if (ride.status === 'COMPLETED') {
      throw new Error('Cannot cancel an already completed ride.');
    }

    ride.status = 'CANCELLED';
    ride.cancellationReason = reason || `Cancelled by ${cancelledBy}`;
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    if (ride.driverId) {
      const driver = db.drivers.get(ride.driverId);
      if (driver) {
        driver.isBusy = false;
        driver.currentRideId = null;
        driver.updatedAt = new Date().toISOString();
        db.drivers.set(driver.driverId, driver);
      }
    }

    socketManager.emitRideUpdate(rideId, 'CANCELLED', {
      rideId,
      status: 'CANCELLED',
      cancelledBy,
      reason: ride.cancellationReason,
    });

    return ride;
  }

  /**
   * Internal assign driver
   */
  public async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    return this.acceptRide(rideId, driverId);
  }

  /**
   * Get ride by ID
   */
  public getRideById(rideId: string): Ride {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);
    return ride;
  }
}

export const rideService = new RideService();
