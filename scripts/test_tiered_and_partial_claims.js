/**
 * =============================================================
 * RESCUEGRID: TIERED DISPATCH, PARTIAL CLAIMING & EXPIRY PROOF
 * Validates:
 * 1. Cascading Priority Tiers (Tier 1 exclusive window protection)
 * 2. In-Place Atomic Partial Claiming (Split batch decrement)
 * 3. Safe Claim Cancellation with Biological Timer Preservation
 * =============================================================
 */

import assert from 'assert';
import { query, pool } from '../server/src/config/database.js';

const API_BASE = process.env.API_URL || 'http://localhost';

async function runTests() {
  console.log('=============================================================');
  console.log('  RESCUEGRID: TIERED DISPATCH, PARTIAL & CANCEL VERIFICATION ');
  console.log('=============================================================\n');

  // Pre-test setup: Reset verified shelter capacities so test is 100% deterministic
  try {
    await query('UPDATE organizations SET available_capacity_kg = capacity_kg WHERE is_verified = TRUE');
  } catch (e) {
    // Non-blocking if running in environment where DB port is not exposed on localhost
  }

  const donorId = '11111111-1111-1111-1111-111111111111';
  // Shelter ccc... has active demand and will be ranked Tier 1
  const priorityShelterId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  // Other shelter without demand
  const nonPriorityShelterId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  // -------------------------------------------------------------------------
  // SUITE 1: Tiered Priority Dispatch Window
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Tiered Priority Dispatch Enforcement]');
  
  const createRes1 = await fetch(`${API_BASE}/api/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      donor_id: donorId,
      food_type: 'Priority Reserved Hot Biryani',
      quantity_kg: 50.0,
      cooked_at: new Date().toISOString(),
      expires_in_seconds: 7200,
      pickup_lat: 12.9716,
      pickup_lng: 77.5946,
      pickup_address: 'Grand Palace Hotel Banquet Hall',
      category: 'COOKED_MEAL',
      dietary_type: 'VEG',
    }),
  });

  assert.strictEqual(createRes1.status, 201, 'Batch 1 created successfully');
  const data1 = await createRes1.json();
  const listingId1 = data1.listing.id;
  console.log(`  [PASS] Created surplus batch: ${listingId1}`);

  // Query nearby to inspect assigned priority recipient
  const nearbyRes0 = await fetch(`${API_BASE}/api/listings/nearby?lat=12.9716&lng=77.5946&radius_km=15`);
  const nearbyData0 = await nearbyRes0.json();
  const listedItem = nearbyData0.listings.find((l) => l.id === listingId1);
  assert(listedItem, 'Listing found in active nearby feed');
  const actualRank1Shelter = listedItem.priority_tier_1_recipient;
  assert(actualRank1Shelter, 'Rank #1 recipient was assigned by matching engine');
  console.log(`  [PASS] Matching engine assigned Rank #1 priority to shelter: ${actualRank1Shelter}`);

  const blockedShelterId = actualRank1Shelter === 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    ? '00000000-0000-0000-0000-000000000000'
    : 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  // Test non-priority shelter attempting to claim during Tier 1 (within first 5 minutes)
  const nonPriorityClaimRes = await fetch(`${API_BASE}/api/listings/${listingId1}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelter_id: blockedShelterId, claim_kg: 20 }),
  });

  assert.strictEqual(nonPriorityClaimRes.status, 403, 'Non-priority claim rejected with HTTP 403');
  const nonPriorityBody = await nonPriorityClaimRes.json();
  assert.strictEqual(nonPriorityBody.code, 'PRIORITY_WINDOW_ACTIVE', 'Response code indicates PRIORITY_WINDOW_ACTIVE');
  assert(nonPriorityBody.retry_after_seconds > 0, 'Includes positive retry_after_seconds');
  console.log(`  [PASS] Non-priority shelter blocked with HTTP 403 (Opens in ${nonPriorityBody.retry_after_seconds}s)`);

  // Test priority shelter claiming during Tier 1
  const priorityClaimRes = await fetch(`${API_BASE}/api/listings/${listingId1}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelter_id: actualRank1Shelter, claim_kg: 20 }),
  });

  assert.strictEqual(priorityClaimRes.status, 200, 'Priority shelter successfully claims during Tier 1');
  const priorityBody = await priorityClaimRes.json();
  assert.strictEqual(priorityBody.claim_type, 'PARTIAL', 'Claim type is PARTIAL');
  assert.strictEqual(priorityBody.claimed_kg, 20, 'Claimed exactly 20 kg');
  assert.strictEqual(priorityBody.quantity_remaining, 30, 'Remaining is exactly 30 kg');
  console.log(`  [PASS] Priority shelter claimed 20 kg, remaining surplus: ${priorityBody.quantity_remaining} kg\n`);

  // -------------------------------------------------------------------------
  // SUITE 2: Atomic Partial & Split Batch Claiming
  // -------------------------------------------------------------------------
  console.log('[Suite 2: Atomic Partial & Split Batch Claiming]');

  // Check nearby listings contains the 30 kg remaining portion
  const nearbyRes = await fetch(`${API_BASE}/api/listings/nearby?lat=12.9716&lng=77.5946&radius_km=15`);
  const nearbyData = await nearbyRes.json();
  const partialListing = nearbyData.listings.find((l) => l.id === listingId1);

  assert(partialListing, 'Partially claimed listing remains visible in nearby radar feed');
  assert.strictEqual(parseFloat(partialListing.quantity_remaining), 30, 'Feed shows 30 kg remaining');
  assert.strictEqual(partialListing.status, 'PARTIALLY_CLAIMED', 'Status in Redis is PARTIALLY_CLAIMED');
  console.log(`  [PASS] Partial listing retained in geo:donations with status PARTIALLY_CLAIMED`);

  // Claim remaining 30 kg (Full claim of remaining portion)
  const secondClaimRes = await fetch(`${API_BASE}/api/listings/${listingId1}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelter_id: actualRank1Shelter, claim_kg: 30 }),
  });

  assert.strictEqual(secondClaimRes.status, 200, 'Remaining 30 kg claimed successfully');
  const secondClaimBody = await secondClaimRes.json();
  assert.strictEqual(secondClaimBody.claim_type, 'FULL', 'Claim type is FULL (exhausted)');
  assert.strictEqual(secondClaimBody.quantity_remaining, 0, 'Remaining is 0 kg');
  console.log(`  [PASS] Remaining 30 kg fully claimed, batch is now exhausted`);

  // Verify it was evicted from active geo feed
  const nearbyRes2 = await fetch(`${API_BASE}/api/listings/nearby?lat=12.9716&lng=77.5946&radius_km=15`);
  const nearbyData2 = await nearbyRes2.json();
  const exhaustedListing = nearbyData2.listings.find((l) => l.id === listingId1);
  assert(!exhaustedListing, 'Fully claimed batch was cleanly evicted from geo:donations index');
  console.log(`  [PASS] Eviction from geo:donations confirmed\n`);

  // -------------------------------------------------------------------------
  // SUITE 3: Claim Cancellation with Biological Timer Preservation
  // -------------------------------------------------------------------------
  console.log('[Suite 3: Claim Cancellation with Biological Shelf-Life Preservation]');

  // Create fresh batch with 2 hours (7200s) TTL
  const createRes3 = await fetch(`${API_BASE}/api/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      donor_id: donorId,
      food_type: 'Fresh Sambar & Rice (40 kg)',
      quantity_kg: 40.0,
      cooked_at: new Date().toISOString(),
      expires_in_seconds: 7200,
      pickup_lat: 12.9716,
      pickup_lng: 77.5946,
      pickup_address: 'Community Center Bangalore',
      category: 'COOKED_MEAL',
      dietary_type: 'VEG',
    }),
  });

  const data3 = await createRes3.json();
  const listingId3 = data3.listing.id;

  // Identify eligible claimant
  const nearbyRes3_init = await fetch(`${API_BASE}/api/listings/nearby?lat=12.9716&lng=77.5946&radius_km=15`);
  const nearbyData3_init = await nearbyRes3_init.json();
  const listedItem3 = nearbyData3_init.listings.find((l) => l.id === listingId3);
  const eligibleShelter3 = listedItem3?.priority_tier_1_recipient || 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  // Claim batch
  const claimRes3 = await fetch(`${API_BASE}/api/listings/${listingId3}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelter_id: eligibleShelter3 }),
  });
  assert.strictEqual(claimRes3.status, 200, 'Batch claimed');
  console.log(`  [PASS] Created and claimed 40 kg batch: ${listingId3}`);

  // Now shelter cancels the claim
  const cancelRes = await fetch(`${API_BASE}/api/listings/${listingId3}/cancel-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelter_id: eligibleShelter3 }),
  });

  assert.strictEqual(cancelRes.status, 200, 'Cancellation succeeded');
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelData.status, 'AVAILABLE', 'Listing status restored to AVAILABLE');
  assert.strictEqual(cancelData.quantity_remaining, 40, 'Full quantity restored to 40 kg');
  assert(cancelData.remaining_seconds > 7000 && cancelData.remaining_seconds <= 7200, 'Exact biological timer preserved without reset');
  console.log(`  [PASS] Cancelled claim: restored 40 kg with ${cancelData.remaining_seconds}s biological timer remaining`);

  // Verify listing reappeared on radar feed
  const nearbyRes3 = await fetch(`${API_BASE}/api/listings/nearby?lat=12.9716&lng=77.5946&radius_km=15`);
  const nearbyData3 = await nearbyRes3.json();
  const restoredListing = nearbyData3.listings.find((l) => l.id === listingId3);
  assert(restoredListing, 'Restored batch successfully reappeared on nearby radar feed');
  assert.strictEqual(parseFloat(restoredListing.quantity_remaining), 40, 'Feed shows 40 kg restored');
  console.log(`  [PASS] Restored batch live and active on radar feed\n`);

  console.log('=============================================================');
  console.log('  ALL TIERED DISPATCH, PARTIAL CLAIM & CANCEL TESTS PASSED!  ');
  console.log('=============================================================');

  try {
    await pool.end();
  } catch {}
}

runTests().catch(async (err) => {
  console.error('\n[TEST FAILURE]', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
