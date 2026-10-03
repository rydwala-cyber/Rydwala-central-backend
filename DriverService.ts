import { db } from '../db/db.ts';
import { Driver, DriverStatus } from '../types/index.ts';
import { socketManager } from '../websocket/socketManager.ts';

export class DriverService {
  /**
   * Get driver by ID
   */
  public getDriverById(driverId: string): Driver {
    const driver = db.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found.`);
    }
    return driver;
  }

  /**
   * Toggle Driver Online / Offline state
   */
  public setOnlineStatus(driverId: string, isOnline: boolean): Driver {
    const driver = this.getDriverById(driverId);

    if (driver.status === 'BLOCKED') {
      throw new Error('Blocked drivers cannot go online.');
    }

    driver.isOnline = isOnline;
    driver.updatedAt = new Date().toISOString();
    db.drivers.set(driverId, driver);

    socketManager.emitToAdmins('DRIVER_ONLINE_STATUS', {
      driverId,
      name: driver.name,
      isOnline,
      vehicleType: driver.vehicleType,
    });

    return driver;
  }

  /**
   * Get all rides associated with a driver
   */
  public getDriverRides(driverId: string) {
    return Array.from(db.rides.values())
      .filter(r => r.driverId === driverId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Admin: Update Driver Status (Active / Blocked / Pending / Expired)
   */
  public updateDriverStatus(driverId: string, status: DriverStatus): Driver {
    const driver = this.getDriverById(driverId);
    driver.status = status;
    if (status === 'BLOCKED' || status === 'EXPIRED') {
      driver.isOnline = false;
    }
    driver.updatedAt = new Date().toISOString();
    db.drivers.set(driverId, driver);
    return driver;
  }

  /**
   * Record Earnings for completed ride
   */
  public addEarnings(driverId: string, amount: number) {
    const driver = db.drivers.get(driverId);
    if (driver) {
      driver.totalEarnings = (driver.totalEarnings || 0) + amount;
      driver.totalRides = (driver.totalRides || 0) + 1;
      driver.isBusy = false;
      driver.currentRideId = null;
      driver.updatedAt = new Date().toISOString();
      db.drivers.set(driverId, driver);
    }
  }
}

export const driverService = new DriverService();
