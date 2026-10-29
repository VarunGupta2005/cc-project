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
    quantity_claimed_kg DECIMAL(10, 2) DEFAULT 0.00,
    quantity_remaining_kg DECIMAL(10, 2),
    category VARCHAR(50) NOT NULL DEFAULT 'COOKED_MEAL',
    dietary_type VARCHAR(50) NOT NULL DEFAULT 'ANY',
    needed_by TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
-- SEED DATA (Root Platform Admin)
-- Password: password123
-- Hashed using standard bcrypt
-- =============================================================

INSERT INTO users (id, email, password_hash, role, full_name, phone)
VALUES 
    ('77777777-7777-7777-7777-777777777777', 'admin@rescuegrid.org', '$2a$10$9I/3ggJo4yGkDK0ZyqyhW.1RiLk7mmvvp7yUX3TXiC2hUrLlz0wtW', 'ADMIN', 'System Operations Admin', '+91 9876543200')
ON CONFLICT (email) DO NOTHING;
