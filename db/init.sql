-- =============================================================
-- RESCUEGRID: POSTGRESQL INITIAL DATABASE SCHEMA & SEEDS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Custom ENUM types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('DONOR', 'SHELTER', 'COURIER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('AVAILABLE', 'CLAIMED', 'IN_TRANSIT', 'DELIVERED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Organizations Table (Physical facility profiles & coordinates)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    org_type VARCHAR(100) NOT NULL, -- 'SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN', 'HOTEL', 'HOSTEL'
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    capacity_kg DECIMAL(10, 2) NOT NULL DEFAULT 50.0,
    available_capacity_kg DECIMAL(10, 2) DEFAULT 50.0,
    can_collect BOOLEAN DEFAULT TRUE,
    accepted_categories TEXT[] DEFAULT '{"COOKED_MEAL","BAKERY","RAW_PRODUCE","PACKAGED"}',
    dietary_restrictions TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Food Listings Table (Master persistent records of food batches)
CREATE TABLE IF NOT EXISTS food_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    food_type VARCHAR(255) NOT NULL, -- 'Cooked Rice & Curry', 'Bakery Items', 'Vegetable Meals', etc.
    quantity_kg DECIMAL(10, 2) NOT NULL,
    cooked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status listing_status DEFAULT 'AVAILABLE',
    pickup_lat DECIMAL(10, 7) NOT NULL,
    pickup_lng DECIMAL(10, 7) NOT NULL,
    pickup_address TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'COOKED_MEAL',
    dietary_type VARCHAR(50) DEFAULT 'VEG',
    preparation_time TIMESTAMP WITH TIME ZONE,
    pickup_deadline TIMESTAMP WITH TIME ZONE,
    consumption_deadline TIMESTAMP WITH TIME ZONE,
    storage_condition VARCHAR(50) DEFAULT 'AMBIENT',
    allergens TEXT[] DEFAULT '{}',
    safety_declared BOOLEAN DEFAULT TRUE,
    claimed_by UUID REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Recipient Requests Table (Structured recipient demand)
CREATE TABLE IF NOT EXISTS recipient_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'COOKED_MEAL',
    dietary_type VARCHAR(50) NOT NULL DEFAULT 'ANY',
    needed_by TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Handover Audits Table (Chain-of-custody and legal compliance)
CREATE TABLE IF NOT EXISTS handover_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES food_listings(id) ON DELETE CASCADE,
    ngo_id UUID REFERENCES organizations(id),
    courier_id UUID REFERENCES users(id),
    pickup_time TIMESTAMP WITH TIME ZONE,
    delivery_time TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255),
    proof_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_listings_status ON food_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_donor ON food_listings(donor_id);
CREATE INDEX IF NOT EXISTS idx_orgs_coords ON organizations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_requests_org_status ON recipient_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_needed_by ON recipient_requests(needed_by);

-- =============================================================
-- SEED DATA (Default Accounts for Instant Testing & Demo)
-- Password for all seed users is 'password123'
-- Hashed using standard bcrypt
-- =============================================================

INSERT INTO users (id, email, password_hash, role, full_name, phone)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'donor@grandhotel.com', '$2b$10$wT8K7H.fN23uP1y5R3r/mep2w6o7TZyQp7Yv7dI1vA3q6c2j6PZvy', 'DONOR', 'Grand Palace Hotel Kitchen', '+91 9876543210'),
    ('22222222-2222-2222-2222-222222222222', 'mess@univhostel.edu', '$2b$10$wT8K7H.fN23uP1y5R3r/mep2w6o7TZyQp7Yv7dI1vA3q6c2j6PZvy', 'DONOR', 'University Central Hostel Mess', '+91 9876543211'),
    ('33333333-3333-3333-3333-333333333333', 'director@hopehaven.org', '$2b$10$wT8K7H.fN23uP1y5R3r/mep2w6o7TZyQp7Yv7dI1vA3q6c2j6PZvy', 'SHELTER', 'Hope Haven Children Home', '+91 9876543212'),
    ('44444444-4444-4444-4444-444444444444', 'care@citykitchen.org', '$2b$10$wT8K7H.fN23uP1y5R3r/mep2w6o7TZyQp7Yv7dI1vA3q6c2j6PZvy', 'SHELTER', 'City Center Night Shelter', '+91 9876543213'),
    ('55555555-5555-5555-5555-555555555555', 'courier@rescuegrid.org', '$2b$10$wT8K7H.fN23uP1y5R3r/mep2w6o7TZyQp7Yv7dI1vA3q6c2j6PZvy', 'COURIER', 'Ravi Kumar (Volunteer Driver)', '+91 9876543214')
ON CONFLICT (email) DO NOTHING;

-- Seed Verified Organizations with sample coordinates (e.g. Bangalore center / Indiranagar / Koramangala coords)
INSERT INTO organizations (id, user_id, name, org_type, latitude, longitude, capacity_kg, is_verified)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Grand Palace Banquet Hall', 'HOTEL', 12.9716, 77.5946, 500.0, TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Campus Hostel Dining Hall', 'HOSTEL', 12.9780, 77.5990, 300.0, TRUE),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Hope Haven Shelter', 'SHELTER', 12.9800, 77.6050, 100.0, TRUE),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'City Care Relief Center', 'COMMUNITY_KITCHEN', 12.9650, 77.5850, 150.0, TRUE)
ON CONFLICT DO NOTHING;

-- Seed Active Recipient Requests for Verified Shelters
INSERT INTO recipient_requests (id, org_id, quantity_kg, category, dietary_type, needed_by, status)
VALUES
    ('11112222-3333-4444-5555-666677778888', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 30.0, 'COOKED_MEAL', 'VEG', CURRENT_TIMESTAMP + INTERVAL '6 hours', 'ACTIVE'),
    ('22223333-4444-5555-6666-777788889999', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 50.0, 'COOKED_MEAL', 'ANY', CURRENT_TIMESTAMP + INTERVAL '8 hours', 'ACTIVE')
ON CONFLICT DO NOTHING;
