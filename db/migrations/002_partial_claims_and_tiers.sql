-- =============================================================
-- RESCUEGRID MIGRATION 002: PARTIAL CLAIMS, TIERED DISPATCH & AUDIT EXTENSION
-- =============================================================

-- 1. Extend listing_status enum with PARTIALLY_CLAIMED
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'PARTIALLY_CLAIMED' AFTER 'AVAILABLE';

-- 2. Add quantity_remaining to food_listings
ALTER TABLE food_listings 
  ADD COLUMN IF NOT EXISTS quantity_remaining NUMERIC(10, 2);

-- Backfill quantity_remaining for all existing records
UPDATE food_listings 
SET quantity_remaining = quantity_kg 
WHERE quantity_remaining IS NULL;

-- 3. Add quantity_claimed_kg to handover_audits
ALTER TABLE handover_audits 
  ADD COLUMN IF NOT EXISTS quantity_claimed_kg NUMERIC(10, 2);

-- Backfill handover_audits quantity_claimed_kg from food_listings if null
UPDATE handover_audits h
SET quantity_claimed_kg = f.quantity_kg
FROM food_listings f
WHERE h.listing_id = f.id AND h.quantity_claimed_kg IS NULL;
