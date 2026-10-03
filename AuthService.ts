import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db.ts';
import { Customer, Driver, AdminUser, AuthJWTPayload, RideOptionType } from '../types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'rydwala_production_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  /**
   * Register Customer
   */
  public async registerCustomer(data: { name: string; phone: string; email?: string; password?: string }) {
    // Check if phone already exists
    const existing = Array.from(db.customers.values()).find(c => c.phone === data.phone);
    if (existing) {
      throw new Error('Customer with this phone number already registered.');
    }

    const customerId = `CUST-${uuidv4().substring(0, 8).toUpperCase()}`;
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const newCustomer: Customer = {
      customerId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim(),
      passwordHash,
      status: 'ACTIVE',
      rating: 5.0,
      totalRides: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.customers.set(customerId, newCustomer);

    const token = this.generateToken({
      userId: customerId,
      role: 'CUSTOMER',
      phone: newCustomer.phone,
      name: newCustomer.name,
    });

    const { passwordHash: _, ...safeCustomer } = newCustomer;
    return { customer: safeCustomer, token };
  }

  /**
   * Login Customer (supports password or OTP login simulation)
   */
  public async loginCustomer(data: { phone: string; password?: string; otp?: string }) {
    let customer = Array.from(db.customers.values()).find(c => c.phone === data.phone.trim());

    if (!customer) {
      // In convenient quick login, auto-register customer if valid phone provided
      const reg = await this.registerCustomer({
        name: `Rider ${data.phone.slice(-4)}`,
        phone: data.phone.trim(),
      });
      return reg;
    }

    if (customer.status === 'BLOCKED') {
      throw new Error('This customer account has been blocked. Please contact Rydwala support.');
    }

    if (data.password && customer.passwordHash) {
      const match = await bcrypt.compare(data.password, customer.passwordHash);
      if (!match) {
        throw new Error('Invalid phone or password.');
      }
    }

    const token = this.generateToken({
      userId: customer.customerId,
      role: 'CUSTOMER',
      phone: customer.phone,
      name: customer.name,
    });

    const { passwordHash: _, ...safeCustomer } = customer;
    return { customer: safeCustomer, token };
  }

  /**
   * Register Driver
   */
  public async registerDriver(data: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    vehicleType: RideOptionType;
    vehicleModel: string;
    vehicleNumber: string;
    licenseNumber?: string;
  }) {
    const existing = Array.from(db.drivers.values()).find(d => d.phone === data.phone.trim());
    if (existing) {
      throw new Error('Driver with this phone number already registered.');
    }

    const driverId = `DRV-${uuidv4().substring(0, 8).toUpperCase()}`;
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const newDriver: Driver = {
      driverId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim(),
      passwordHash,
      vehicleType: data.vehicleType,
      vehicleModel: data.vehicleModel.trim(),
      vehicleNumber: data.vehicleNumber.trim().toUpperCase(),
      licenseNumber: data.licenseNumber?.trim().toUpperCase(),
      status: 'ACTIVE',
      isOnline: true,
      isBusy: false,
      rating: 5.0,
      totalRides: 0,
      totalEarnings: 0,
      currentLocation: {
        lat: 18.5204,
        lng: 73.8567,
        address: 'Pune Central, Maharashtra',
        heading: 0,
        speed: 0,
        updatedAt: new Date().toISOString(),
      },
      currentRideId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.drivers.set(driverId, newDriver);

    const token = this.generateToken({
      userId: driverId,
      role: 'DRIVER',
      phone: newDriver.phone,
      name: newDriver.name,
    });

    const { passwordHash: _, ...safeDriver } = newDriver;
    return { driver: safeDriver, token };
  }

  /**
   * Login Driver
   */
  public async loginDriver(data: { phone?: string; password?: string; otp?: string; driverId?: string }) {
    const rawPhone = (data.phone || '').trim().replace(/\D/g, '');
    const isTestDriver = rawPhone.endsWith('8055090915') || (data.driverId && data.driverId.includes('8055090915'));

    let driver: Driver | undefined;

    if (isTestDriver) {
      const testDriverId = 'DRV-TEST-8055090915';
      driver = db.drivers.get(testDriverId) || Array.from(db.drivers.values()).find(d => d.phone.endsWith('8055090915'));

      if (!driver) {
        const hashedTestPassword = await bcrypt.hash('2210', 10);
        driver = {
          driverId: testDriverId,
          name: 'Sachin Gaikwad (Test Driver)',
          phone: '8055090915',
          email: 'driver8055090915@rydwala.com',
          passwordHash: hashedTestPassword,
          vehicleType: 'AUTO',
          vehicleModel: 'Bajaj Compact RE',
          vehicleNumber: 'MH 12 AB 9015',
          licenseNumber: 'MH12-2022-8055090915',
          status: 'ACTIVE',
          isOnline: true,
          isBusy: false,
          rating: 4.95,
          totalRides: 120,
          totalEarnings: 15400,
          currentLocation: {
            lat: 18.5204,
            lng: 73.8567,
            address: 'Pune Central, Maharashtra',
            heading: 0,
            speed: 0,
            updatedAt: new Date().toISOString(),
          },
          currentRideId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.drivers.set(testDriverId, driver);
      }

      const credential = (data.password || data.otp || '').trim();
      if (credential && credential !== '2210') {
        if (driver.passwordHash) {
          const match = await bcrypt.compare(credential, driver.passwordHash);
          if (!match) {
            throw new Error('Invalid test driver OTP/password. Use 2210.');
          }
        }
      }

      driver.status = 'ACTIVE';
      driver.isOnline = true;
      driver.updatedAt = new Date().toISOString();
      db.drivers.set(driver.driverId, driver);

      const token = this.generateToken({
        userId: driver.driverId,
        role: 'DRIVER',
        phone: driver.phone,
        name: driver.name,
      });

      const { passwordHash: _, ...safeDriver } = driver;
      return { driver: safeDriver, token };
    }

    if (data.driverId) {
      driver = db.drivers.get(data.driverId);
    } else if (data.phone) {
      driver = Array.from(db.drivers.values()).find(d => d.phone === data.phone?.trim() || d.phone.endsWith(rawPhone));
    }

    if (!driver) {
      throw new Error('Driver not found with provided credentials.');
    }

    if (driver.status === 'BLOCKED') {
      throw new Error('Driver account is blocked by Rydwala Admin.');
    }

    const credential = (data.password || data.otp || '').trim();
    if (credential && driver.passwordHash) {
      const match = await bcrypt.compare(credential, driver.passwordHash);
      if (!match) {
        throw new Error('Invalid credentials.');
      }
    }

    const token = this.generateToken({
      userId: driver.driverId,
      role: 'DRIVER',
      phone: driver.phone,
      name: driver.name,
    });

    const { passwordHash: _, ...safeDriver } = driver;
    return { driver: safeDriver, token };
  }

  /**
   * Admin Login
   */
  public async loginAdmin(data: { username: string; password?: string }) {
    const admin = Array.from(db.adminUsers.values()).find(
      a => a.username === data.username.trim() || a.email === data.username.trim()
    );

    if (!admin) {
      throw new Error('Admin credentials invalid.');
    }

    if (data.password) {
      const match = await bcrypt.compare(data.password, admin.passwordHash);
      if (!match) {
        throw new Error('Invalid admin password.');
      }
    }

    const token = this.generateToken({
      userId: admin.adminId,
      role: 'ADMIN',
      name: admin.name,
    });

    const { passwordHash: _, ...safeAdmin } = admin;
    return { admin: safeAdmin, token };
  }

  private generateToken(payload: AuthJWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }
}

export const authService = new AuthService();
