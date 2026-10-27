-- =============================================================
-- RESCUEGRID MIGRATION 001: DEADLINE & DEMAND SCHEMA EXTENSION
-- =============================================================

-- 1. Extend food_listings with food safety, categorization, and separate deadlines
ALTER TABLE food_listings 
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'COOKED_MEAL',
  ADD COLUMN IF NOT EXISTS dietary_type VARCHAR(50) DEFAULT 'VEG',
  ADD COLUMN IF NOT EXISTS preparation_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pickup_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS consumption_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(50) DEFAULT 'AMBIENT',
  ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_declared BOOLEAN DEFAULT TRUE;

-- Backfill existing food_listings
UPDATE food_listings 
SET preparation_time = COALESCE(preparation_time, cooked_at),
    pickup_deadline = COALESCE(pickup_deadline, expires_at),
    consumption_deadline = COALESCE(consumption_deadline, expires_at + INTERVAL '2 hours')
WHERE preparation_time IS NULL OR pickup_deadline IS NULL OR consumption_deadline IS NULL;

-- 2. Extend organizations with operational collection capability and dynamic capacity
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS available_capacity_kg DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS can_collect BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS accepted_categories TEXT[] DEFAULT '{"COOKED_MEAL","BAKERY","RAW_PRODUCE","PACKAGED"}',
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';

-- Backfill existing organizations available_capacity_kg to match current capacity_kg
UPDATE organizations 
SET available_capacity_kg = COALESCE(available_capacity_kg, capacity_kg)
WHERE available_capacity_kg IS NULL;

-- 3. Create recipient_requests table for structured recipient demand
CREATE TABLE IF NOT EXISTS recipient_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'COOKED_MEAL',
    dietary_type VARCHAR(50) NOT NULL DEFAULT 'ANY',
    needed_by TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- 'ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_org_status ON recipient_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_needed_by ON recipient_requests(needed_by);

-- 4. Seed initial active recipient requirements for verified demo shelters if none exist
INSERT INTO recipient_requests (id, org_id, quantity_kg, category, dietary_type, needed_by, status)
SELECT '11112222-3333-4444-5555-666677778888'::uuid, 
       'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 
       30.0, 
       'COOKED_MEAL', 
       'VEG', 
       CURRENT_TIMESTAMP + INTERVAL '6 hours', 
       'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM recipient_requests WHERE org_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
);

INSERT INTO recipient_requests (id, org_id, quantity_kg, category, dietary_type, needed_by, status)
SELECT '22223333-4444-5555-6666-777788889999'::uuid, 
       'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 
       50.0, 
       'COOKED_MEAL', 
       'ANY', 
       CURRENT_TIMESTAMP + INTERVAL '8 hours', 
       'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM recipient_requests WHERE org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
);
