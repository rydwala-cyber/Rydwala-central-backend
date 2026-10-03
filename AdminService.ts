import { db } from '../db/db.ts';
import { AppSettings, CustomerStatus, DriverStatus } from '../types/index.ts';
import { socketManager } from '../websocket/socketManager.ts';

export class AdminService {
  /**
   * Get Real-time Dashboard KPIs
   */
  public getDashboardStats() {
    const customers = Array.from(db.customers.values());
    const drivers = Array.from(db.drivers.values());
    const rides = Array.from(db.rides.values());
    const payments = Array.from(db.payments.values());
    const transactions = Array.from(db.transactions.values());

    const totalCustomers = customers.length;
    const totalRegisteredDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === 'ACTIVE').length;
    const pendingApprovalDrivers = drivers.filter(d => d.status === 'PENDING_APPROVAL').length;
    const blockedDrivers = drivers.filter(d => d.status === 'BLOCKED').length;
    const expiredDrivers = drivers.filter(d => d.status === 'EXPIRED').length;
    const onlineDrivers = drivers.filter(d => d.isOnline && d.status === 'ACTIVE').length;
    const busyDrivers = drivers.filter(d => d.isBusy).length;

    const activeRides = rides.filter(r =>
      ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'RIDE_STARTED', 'ON_TRIP'].includes(r.status)
    );
    const completedRides = rides.filter(r => r.status === 'COMPLETED');
    const cancelledRides = rides.filter(r => r.status === 'CANCELLED');

    const totalRevenue = payments
      .filter(p => p.status === 'PAYMENT_SUCCESSFUL')
      .reduce((acc, p) => acc + p.amount, 0);

    const platformCommission = transactions
      .filter(t => t.status === 'SUCCESS')
      .reduce((acc, t) => acc + (t.platformFee || 0), 0);

    const driverPayouts = transactions
      .filter(t => t.status === 'SUCCESS')
      .reduce((acc, t) => acc + (t.driverEarnings || 0), 0);

    const wsClients = socketManager.getConnectedClientsCount();

    return {
      kpis: {
        totalCustomers,
        totalRegisteredDrivers,
        activeDrivers,
        pendingApprovalDrivers,
        blockedDrivers,
        expiredDrivers,
        onlineDrivers,
        busyDrivers,
        activeRidesCount: activeRides.length,
        completedRidesCount: completedRides.length,
        cancelledRidesCount: cancelledRides.length,
        totalRidesCount: rides.length,
        totalRevenue,
        platformCommission,
        driverPayouts,
      },
      wsClients,
      settings: db.settings,
      recentRides: rides.slice(-10).reverse(),
      isPostgresConnected: db.isPostgresConnected,
    };
  }

  /**
   * Get all Drivers with filters
   */
  public getRidersList() {
    return Array.from(db.drivers.values()).map(d => {
      const { passwordHash: _, ...safeDriver } = d;
      return safeDriver;
    });
  }

  /**
   * Update Driver KYC / Approval / Block status
   */
  public updateRiderStatus(driverId: string, status: DriverStatus) {
    const driver = db.drivers.get(driverId);
    if (!driver) throw new Error(`Driver ${driverId} not found.`);

    driver.status = status;
    if (status === 'BLOCKED' || status === 'EXPIRED') {
      driver.isOnline = false;
    }
    driver.updatedAt = new Date().toISOString();
    db.drivers.set(driverId, driver);

    socketManager.emitToDriver(driverId, 'STATS_UPDATED', {
      status,
      message: `Your driver account status is now ${status}.`,
    });

    return driver;
  }

  /**
   * Get all Customers
   */
  public getCustomersList() {
    return Array.from(db.customers.values()).map(c => {
      const { passwordHash: _, ...safeCustomer } = c;
      return safeCustomer;
    });
  }

  /**
   * Update Customer status (ACTIVE / BLOCKED)
   */
  public updateCustomerStatus(customerId: string, status: CustomerStatus) {
    const customer = db.customers.get(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found.`);

    customer.status = status;
    customer.updatedAt = new Date().toISOString();
    db.customers.set(customerId, customer);
    return customer;
  }

  /**
   * Get all Rides
   */
  public getAllRides() {
    return Array.from(db.rides.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get all Payments & Transactions
   */
  public getAllPayments() {
    return {
      payments: Array.from(db.payments.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      transactions: Array.from(db.transactions.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    };
  }

  /**
   * Update Settings & UPI Configuration
   */
  public updateSettings(settingsData: Partial<AppSettings>): AppSettings {
    Object.assign(db.settings, settingsData);
    if (typeof settingsData.demoMode === 'boolean') {
      db.settings.allowDemoOtp = settingsData.demoMode;
    }
    return db.settings;
  }
}

export const adminService = new AdminService();
