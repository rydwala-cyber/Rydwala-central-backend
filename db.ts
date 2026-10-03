import pg from 'pg';
import bcrypt from 'bcryptjs';
import {
  Customer,
  Driver,
  Ride,
  Payment,
  Transaction,
  ServiceArea,
  AdminUser,
  AppSettings,
} from '../types/index.ts';

const { Pool } = pg;

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: pg.Pool | null = null;
  public isPostgresConnected = false;

  // In-memory relational tables (fallback and cache)
  public customers: Map<string, Customer> = new Map();
  public drivers: Map<string, Driver> = new Map();
  public rides: Map<string, Ride> = new Map();
  public payments: Map<string, Payment> = new Map();
  public transactions: Map<string, Transaction> = new Map();
  public serviceAreas: Map<string, ServiceArea> = new Map();
  public adminUsers: Map<string, AdminUser> = new Map();
  public settings: AppSettings = {
    demoMode: process.env.DEMO_MODE === 'true',
    allowDemoOtp: process.env.DEMO_MODE === 'true',
    platformCommissionPercent: 15,
    surgeMultiplier: 1.0,
    upiMerchantId: process.env.UPI_MERCHANT_ID || 'rydwala@icici',
    upiMerchantName: process.env.UPI_MERCHANT_NAME || 'Rydwala Mobility Pvt Ltd',
    autoAssignDrivers: false,
  };

  private constructor() {
    this.initPool();
    this.seedInitialData();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private async initPool() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString && !connectionString.includes('localhost:5432')) {
      try {
        this.pool = new Pool({
          connectionString,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        const client = await this.pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        this.isPostgresConnected = true;
        console.log('✅ Connected to PostgreSQL database successfully.');
      } catch (err) {
        console.warn('⚠️ PostgreSQL connection not available. Running Central In-Memory Relational Engine with Postgres Schema parity.', (err as Error).message);
        this.isPostgresConnected = false;
      }
    } else {
      console.log('ℹ️ Running Central Backend Relational Storage Engine (Production-ready schema & models)');
    }
  }

  public async seedInitialData() {
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedDriverPassword = await bcrypt.hash('driver123', 10);
    const hashedCustomerPassword = await bcrypt.hash('customer123', 10);

    // 1. Seed Admin
    const defaultAdmin: AdminUser = {
      adminId: 'ADM-001',
      username: 'admin',
      name: 'Rydwala Operations Admin',
      email: 'admin@rydwala.com',
      passwordHash: hashedAdminPassword,
      role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(),
    };
    this.adminUsers.set(defaultAdmin.adminId, defaultAdmin);

    // 2. Seed Service Areas (Maharashtra Hubs)
    const areas: ServiceArea[] = [
      {
        areaId: 'AREA-PUNE',
        name: 'Pune Metropolitan Region (PMRDA)',
        city: 'Pune',
        state: 'Maharashtra',
        centerLat: 18.5204,
        centerLng: 73.8567,
        radiusKm: 35,
        baseFare: 40,
        perKmRate: 14,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        areaId: 'AREA-MUMBAI',
        name: 'Mumbai & Navi Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        centerLat: 19.0760,
        centerLng: 72.8777,
        radiusKm: 45,
        baseFare: 50,
        perKmRate: 16,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        areaId: 'AREA-NASHIK',
        name: 'Nashik Smart City',
        city: 'Nashik',
        state: 'Maharashtra',
        centerLat: 19.9975,
        centerLng: 73.7898,
        radiusKm: 25,
        baseFare: 35,
        perKmRate: 12,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        areaId: 'AREA-NAGPUR',
        name: 'Nagpur Central Metro',
        city: 'Nagpur',
        state: 'Maharashtra',
        centerLat: 21.1458,
        centerLng: 79.0882,
        radiusKm: 30,
        baseFare: 35,
        perKmRate: 13,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];
    areas.forEach(a => this.serviceAreas.set(a.areaId, a));

    // 3. Seed Verified Drivers
    const drivers: Driver[] = [
      {
        driverId: 'DRV-101',
        name: 'Sachin Patil',
        phone: '9876543210',
        email: 'sachin.patil@rydwala.com',
        passwordHash: hashedDriverPassword,
        vehicleType: 'AUTO',
        vehicleModel: 'Bajaj Compact RE',
        vehicleNumber: 'MH 12 AB 4590',
        licenseNumber: 'MH12-2018-0045901',
        status: 'ACTIVE',
        isOnline: true,
        isBusy: false,
        rating: 4.92,
        totalRides: 482,
        totalEarnings: 38500,
        currentLocation: {
          lat: 18.5314,
          lng: 73.8446,
          address: 'Shivajinagar, Pune, Maharashtra',
          heading: 45,
          speed: 0,
          updatedAt: new Date().toISOString(),
        },
        currentRideId: null,
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: new Date().toISOString(),
      },
      {
        driverId: 'DRV-TEST-8055090915',
        name: 'Sachin Gaikwad (Test Driver)',
        phone: '8055090915',
        email: 'driver8055090915@rydwala.com',
        passwordHash: await bcrypt.hash('2210', 10),
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
      },
      {
        driverId: 'DRV-102',
        name: 'Rahul Deshmukh',
        phone: '9822334455',
        email: 'rahul.d@rydwala.com',
        passwordHash: hashedDriverPassword,
        vehicleType: 'SEDAN',
        vehicleModel: 'Maruti Suzuki Dzire',
        vehicleNumber: 'MH 12 CD 8821',
        licenseNumber: 'MH12-2019-0099231',
        status: 'ACTIVE',
        isOnline: true,
        isBusy: false,
        rating: 4.88,
        totalRides: 312,
        totalEarnings: 62400,
        currentLocation: {
          lat: 18.5204,
          lng: 73.8567,
          address: 'FC Road, Deccan, Pune',
          heading: 90,
          speed: 12,
          updatedAt: new Date().toISOString(),
        },
        currentRideId: null,
        createdAt: '2026-02-15T09:30:00.000Z',
        updatedAt: new Date().toISOString(),
      },
      {
        driverId: 'DRV-103',
        name: 'Manoj Shinde',
        phone: '9977886655',
        email: 'manoj.s@rydwala.com',
        passwordHash: hashedDriverPassword,
        vehicleType: 'BIKE',
        vehicleModel: 'Hero Splendor Plus',
        vehicleNumber: 'MH 14 EF 1234',
        licenseNumber: 'MH14-2021-0023411',
        status: 'ACTIVE',
        isOnline: true,
        isBusy: false,
        rating: 4.95,
        totalRides: 650,
        totalEarnings: 29800,
        currentLocation: {
          lat: 18.5590,
          lng: 73.7868,
          address: 'Baner Main Road, Pune',
          heading: 180,
          speed: 0,
          updatedAt: new Date().toISOString(),
        },
        currentRideId: null,
        createdAt: '2026-01-20T11:00:00.000Z',
        updatedAt: new Date().toISOString(),
      },
      {
        driverId: 'DRV-104',
        name: 'Amit Ghorpade',
        phone: '9123456789',
        email: 'amit.g@rydwala.com',
        passwordHash: hashedDriverPassword,
        vehicleType: 'MINI',
        vehicleModel: 'Tata Tiago EV',
        vehicleNumber: 'MH 12 EV 9901',
        licenseNumber: 'MH12-2022-0044556',
        status: 'PENDING_APPROVAL',
        isOnline: false,
        isBusy: false,
        rating: 5.0,
        totalRides: 0,
        totalEarnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    drivers.forEach(d => this.drivers.set(d.driverId, d));

    // 4. Seed Customers
    const customers: Customer[] = [
      {
        customerId: 'CUST-001',
        name: 'Aniket More',
        phone: '9890123456',
        email: 'aniket.more@gmail.com',
        passwordHash: hashedCustomerPassword,
        status: 'ACTIVE',
        rating: 4.95,
        totalRides: 18,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: new Date().toISOString(),
      },
      {
        customerId: 'CUST-002',
        name: 'Pooja Kulkarni',
        phone: '9765432109',
        email: 'pooja.k@gmail.com',
        passwordHash: hashedCustomerPassword,
        status: 'ACTIVE',
        rating: 5.0,
        totalRides: 7,
        createdAt: '2026-02-01T14:30:00.000Z',
        updatedAt: new Date().toISOString(),
      },
    ];
    customers.forEach(c => this.customers.set(c.customerId, c));
  }
}

export const db = DatabaseManager.getInstance();
