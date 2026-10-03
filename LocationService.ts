import { db } from '../db/db.ts';
import { fareService } from './FareService.ts';
import { socketManager } from '../websocket/socketManager.ts';
import { Driver, LocationCoordinates, RideOptionType } from '../types/index.ts';

export class LocationService {
  /**
   * Update driver's live GPS location and broadcast to active riders
   */
  public updateDriverLocation(
    driverId: string,
    coords: {
      lat: number;
      lng: number;
      address?: string;
      heading?: number;
      speed?: number;
    }
  ) {
    const driver = db.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver with ID ${driverId} not found.`);
    }

    const updatedLocation: LocationCoordinates = {
      lat: coords.lat,
      lng: coords.lng,
      address: coords.address || driver.currentLocation?.address || 'Current Location',
      heading: coords.heading ?? driver.currentLocation?.heading ?? 0,
      speed: coords.speed ?? driver.currentLocation?.speed ?? 0,
      updatedAt: new Date().toISOString(),
    };

    driver.currentLocation = updatedLocation;
    driver.updatedAt = new Date().toISOString();
    db.drivers.set(driverId, driver);

    // If driver is in an active ride, emit live location directly to the ride channel & customer
    if (driver.currentRideId) {
      const ride = db.rides.get(driver.currentRideId);
      if (ride && ['DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'RIDE_STARTED', 'ON_TRIP'].includes(ride.status)) {
        socketManager.emitToCustomer(ride.customerId, 'DRIVER_LOCATION_UPDATE', {
          rideId: ride.rideId,
          driverId: driver.driverId,
          location: updatedLocation,
        });

        socketManager.emitRideUpdate(ride.rideId, 'DRIVER_LOCATION_UPDATE', {
          rideId: ride.rideId,
          driverId: driver.driverId,
          location: updatedLocation,
        });
      }
    }

    return driver;
  }

  /**
   * Find online available drivers near a pickup location
   */
  public findNearbyDrivers(
    lat: number,
    lng: number,
    vehicleType?: RideOptionType,
    radiusKm = 15
  ): (Driver & { distanceToPickupKm: number })[] {
    const availableDrivers: (Driver & { distanceToPickupKm: number })[] = [];

    for (const driver of db.drivers.values()) {
      if (driver.status === 'ACTIVE' && driver.isOnline && !driver.isBusy && driver.currentLocation) {
        if (!vehicleType || driver.vehicleType === vehicleType) {
          const dist = fareService.calculateDistance(
            lat,
            lng,
            driver.currentLocation.lat,
            driver.currentLocation.lng
          );

          if (dist <= radiusKm) {
            availableDrivers.push({
              ...driver,
              distanceToPickupKm: dist,
            });
          }
        }
      }
    }

    return availableDrivers.sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
  }
}

export const locationService = new LocationService();
