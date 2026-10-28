-- =============================================================
-- RESCUEGRID MIGRATION 004: RIDER AVAILABILITY & ALLOCATIONS BACKFILL
-- =============================================================

-- 1. Add availability toggle to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

-- 2. Backfill allocations for any existing claimed food listings
INSERT INTO allocations (listing_id, shelter_id, allocated_kg, status)
SELECT f.id, f.claimed_by, COALESCE(f.quantity_kg, 10), 
       CASE WHEN f.status = 'DELIVERED' THEN 'DELIVERED'
            WHEN f.status = 'IN_TRANSIT' THEN 'IN_TRANSIT'
            ELSE 'RESERVED' END
FROM food_listings f
WHERE f.claimed_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM allocations a WHERE a.listing_id = f.id AND a.shelter_id = f.claimed_by);
