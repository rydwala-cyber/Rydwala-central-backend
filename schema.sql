-- Rydwala Central Backend Database Schema (PostgreSQL)
-- Production Ready Relational Schema with Constraints, Foreign Keys & Indexes

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Service Areas Table
CREATE TABLE IF NOT EXISTS service_areas (
    area_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    city VARCHAR(64) NOT NULL,
    state VARCHAR(64) NOT NULL,
    center_lat NUMERIC(10, 7) NOT NULL,
    center_lng NUMERIC(10, 7) NOT NULL,
    radius_km NUMERIC(6, 2) NOT NULL DEFAULT 25.00,
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
    per_km_rate NUMERIC(10, 2) NOT NULL DEFAULT 12.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(128) UNIQUE,
    password_hash VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- 4. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    driver_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(128),
    password_hash VARCHAR(255),
    vehicle_type VARCHAR(32) NOT NULL,
    vehicle_model VARCHAR(128) NOT NULL,
    vehicle_number VARCHAR(32) NOT NULL,
    license_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    is_busy BOOLEAN NOT NULL DEFAULT FALSE,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    total_rides INTEGER DEFAULT 0,
    total_earnings NUMERIC(12, 2) DEFAULT 0.00,
    current_lat NUMERIC(10, 7),
    current_lng NUMERIC(10, 7),
    current_address TEXT,
    heading NUMERIC(6, 2) DEFAULT 0,
    speed NUMERIC(6, 2) DEFAULT 0,
    location_updated_at TIMESTAMP WITH TIME ZONE,
    current_ride_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON drivers(is_online, is_busy, status);
CREATE INDEX IF NOT EXISTS idx_drivers_vehicle_type ON drivers(vehicle_type);

-- 5. Rides Table
CREATE TABLE IF NOT EXISTS rides (
    ride_id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    driver_id VARCHAR(64) REFERENCES drivers(driver_id) ON DELETE SET NULL,
    customer_name VARCHAR(128) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    driver_name VARCHAR(128),
    driver_phone VARCHAR(20),
    vehicle_model VARCHAR(128),
    vehicle_number VARCHAR(32),
    vehicle_type VARCHAR(32) NOT NULL,
    pickup TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    pickup_lat NUMERIC(10, 7) NOT NULL,
    pickup_lng NUMERIC(10, 7) NOT NULL,
    drop_lat NUMERIC(10, 7) NOT NULL,
    drop_lng NUMERIC(10, 7) NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    duration_mins INTEGER DEFAULT 15,
    fare NUMERIC(10, 2) NOT NULL,
    ride_option VARCHAR(32) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'SEARCHING',
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PAYMENT_PENDING',
    cancellation_reason TEXT,
    arrived_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rides_customer_id ON rides(customer_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at DESC);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    driver_id VARCHAR(64) REFERENCES drivers(driver_id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PAYMENT_PENDING',
    transaction_ref VARCHAR(128),
    upi_qr_url TEXT,
    collected_by_driver BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 7. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    payment_id VARCHAR(64) REFERENCES payments(payment_id) ON DELETE SET NULL,
    ride_id VARCHAR(64) REFERENCES rides(ride_id) ON DELETE SET NULL,
    type VARCHAR(32) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    driver_earnings NUMERIC(10, 2) DEFAULT 0.00,
    platform_fee NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
