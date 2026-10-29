-- =============================================================
-- RESCUEGRID MIGRATION 003: RIDER DISPATCH, ALLOCATIONS & ADMIN AUDIT REFACTOR
-- =============================================================

-- 1. Extend user_role enum with RIDER
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RIDER' AFTER 'COURIER';

-- 2. Link users to organizations (Shelter staff, couriers, and riders)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- 3. Extend organizations with formal verification status
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'PENDING';

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);

-- Backfill verification_status for existing organizations
UPDATE organizations 
SET verification_status = CASE WHEN is_verified IS FALSE THEN 'PENDING' ELSE 'VERIFIED' END
WHERE verification_status IS NULL;

-- 4. Allocations Table (Decoupled claim lifecycle per recipient parcel)
CREATE TABLE IF NOT EXISTS allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
    shelter_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    allocated_kg DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RESERVED', -- 'RESERVED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allocations_listing ON allocations(listing_id);
CREATE INDEX IF NOT EXISTS idx_allocations_shelter ON allocations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);

-- 5. Delivery Assignments Table (Rider dispatch and physical custody tracking)
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED', -- 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'COMPLETED', 'DECLINED', 'CANCELLED'
    pickup_otp VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crucial: Guarantee at most ONE active rider assignment per allocation at the database engine level
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_rider_per_alloc 
ON delivery_assignments (allocation_id) 
WHERE status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP');

CREATE INDEX IF NOT EXISTS idx_assignments_rider ON delivery_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON delivery_assignments(status);

-- 6. Handover Audits: Store allocation reference and cryptographic digest (redacting plaintext codes)
ALTER TABLE handover_audits 
  ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES allocations(id) ON DELETE SET NULL;

ALTER TABLE handover_audits 
  ADD COLUMN IF NOT EXISTS token_digest VARCHAR(255);

-- 7. Seed Admin account (password123)
-- bcrypt hash for 'password123': $2a$10$9I/3ggJo4yGkDK0ZyqyhW.1RiLk7mmvvp7yUX3TXiC2hUrLlz0wtW
INSERT INTO users (id, email, password_hash, role, full_name, phone, organization_id)
VALUES 
  ('77777777-7777-7777-7777-777777777777', 'admin@rescuegrid.org', '$2a$10$9I/3ggJo4yGkDK0ZyqyhW.1RiLk7mmvvp7yUX3TXiC2hUrLlz0wtW', 'ADMIN', 'System Operations Admin', '+91 99999 00000', NULL)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role;
