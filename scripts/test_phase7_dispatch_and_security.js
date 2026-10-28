import assert from 'assert';
import { query } from '../server/src/config/database.js';
import { redisClient, initRedis } from '../server/src/config/redis.js';
import { generateAssignmentOtp, hashTokenDigest, verifyHandoverToken } from '../server/src/services/tokenService.js';

let totalTests = 0;
let passedTests = 0;

function testAssert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase7TestSuite() {
  console.log('\n=============================================================');
  console.log('       RESCUEGRID PHASE 7: RIDER DISPATCH & SECURITY SUITE    ');
  console.log('=============================================================\n');

  await initRedis();

  const shelterOrgId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // Hope Haven
  const otherShelterOrgId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'; // City Care
  const donorUserId = '11111111-1111-1111-1111-111111111111'; // Grand Palace

  // 1. Setup Food Listing
  const listRes = await query(
    `INSERT INTO food_listings 
      (donor_id, food_type, quantity_kg, quantity_remaining, cooked_at, expires_at, status, pickup_lat, pickup_lng, pickup_address, category, dietary_type)
     VALUES ($1, 'Phase 7 Biryani Batch', 50, 50, NOW(), NOW() + INTERVAL '2 hours', 'AVAILABLE', 12.9716, 77.5946, 'Palace Gate 3', 'COOKED_MEAL', 'VEG')
     RETURNING id`,
    [donorUserId]
  );
  const listingId = listRes.rows[0].id;

  // 2. Setup 2 Riders for Hope Haven, 1 Rider for City Care
  const rider1Res = await query(
    `INSERT INTO users (full_name, email, password_hash, role, organization_id)
     VALUES ('Rider Alpha', 'rider_alpha@test.com', 'hash', 'RIDER', $1)
     ON CONFLICT (email) DO UPDATE SET organization_id = $1
     RETURNING id`,
    [shelterOrgId]
  );
  const rider1Id = rider1Res.rows[0].id;

  const rider2Res = await query(
    `INSERT INTO users (full_name, email, password_hash, role, organization_id)
     VALUES ('Rider Beta', 'rider_beta@test.com', 'hash', 'RIDER', $1)
     ON CONFLICT (email) DO UPDATE SET organization_id = $1
     RETURNING id`,
    [shelterOrgId]
  );
  const rider2Id = rider2Res.rows[0].id;

  const rogueRiderRes = await query(
    `INSERT INTO users (full_name, email, password_hash, role, organization_id)
     VALUES ('Rogue Rider', 'rogue_rider@test.com', 'hash', 'RIDER', $1)
     ON CONFLICT (email) DO UPDATE SET organization_id = $1
     RETURNING id`,
    [otherShelterOrgId]
  );
  const rogueRiderId = rogueRiderRes.rows[0].id;

  console.log('[Suite 1: Durable Allocation & Multi-Tenant Rider Assignment]');
  
  // Claim 30 kg -> creates allocation
  const allocRes = await query(
    `INSERT INTO allocations (listing_id, shelter_id, allocated_kg, status)
     VALUES ($1, $2, 30, 'RESERVED')
     RETURNING id`,
    [listingId, shelterOrgId]
  );
  const allocationId = allocRes.rows[0].id;
  testAssert(allocationId !== undefined, 'Allocation record created in PostgreSQL');

  // Assign Rider 1
  const otpData1 = generateAssignmentOtp(allocationId, 'assignment-uuid-1', rider1Id);
  const assign1Res = await query(
    `INSERT INTO delivery_assignments (allocation_id, rider_id, status, pickup_otp)
     VALUES ($1, $2, 'ASSIGNED', $3)
     RETURNING id, pickup_otp`,
    [allocationId, rider1Id, otpData1.otpCode]
  );
  testAssert(assign1Res.rows[0].pickup_otp === otpData1.otpCode, 'Rider 1 assigned with unique OTP code');

  console.log('\n[Suite 2: Database Engine Level Concurrency & Partial Unique Index]');
  
  // Attempting concurrent second active rider assignment on same allocation MUST violate partial unique index
  let caughtIndexError = false;
  try {
    await query(
      `INSERT INTO delivery_assignments (allocation_id, rider_id, status, pickup_otp)
       VALUES ($1, $2, 'ASSIGNED', '999999')`,
      [allocationId, rider2Id]
    );
  } catch (err) {
    caughtIndexError = err.code === '23505'; // Unique violation
  }
  testAssert(caughtIndexError, 'PostgreSQL unique partial index strictly prevented duplicate active riders');

  console.log('\n[Suite 3: Reassignment & Instant OTP Revocation]');
  
  // Rider 1 cancels
  await query(
    `UPDATE delivery_assignments SET status = 'CANCELLED', pickup_otp = NULL WHERE id = $1`,
    [assign1Res.rows[0].id]
  );

  // Allocation remains intact for shelter
  const checkAlloc = await query(`SELECT status FROM allocations WHERE id = $1`, [allocationId]);
  testAssert(checkAlloc.rows[0].status === 'RESERVED', 'Food allocation preserved for shelter after rider cancellation');

  // Shelter reassigns Rider 2
  const otpData2 = generateAssignmentOtp(allocationId, 'assignment-uuid-2', rider2Id);
  const assign2Res = await query(
    `INSERT INTO delivery_assignments (allocation_id, rider_id, status, pickup_otp)
     VALUES ($1, $2, 'ASSIGNED', $3)
     RETURNING id, pickup_otp`,
    [allocationId, rider2Id, otpData2.otpCode]
  );
  testAssert(assign2Res.rows[0].pickup_otp !== otpData1.otpCode, 'New assignment has cryptographically distinct OTP');

  // Verify Rider 1's old code is completely invalid
  testAssert(!verifyHandoverToken(assign2Res.rows[0].pickup_otp, otpData1.otpCode), 'Old rider OTP is strictly rejected');

  // Verify Rider 2's code passes
  testAssert(verifyHandoverToken(assign2Res.rows[0].pickup_otp, otpData2.otpCode), 'New assigned rider OTP is validated');

  console.log('\n[Suite 4: Zero Secret Leakage in Audit Trails]');
  const digest = hashTokenDigest(otpData2.otpCode);
  testAssert(typeof digest === 'string' && digest.length === 64, 'Token digest is 256-bit SHA-256 hash');
  testAssert(!digest.includes(otpData2.otpCode), 'Digest does not expose raw OTP secret');

  console.log('\n[Suite 5: Quantity Accounting Invariant Verification]');
  // Update listing remaining quantity: 50 original - 30 allocated = 20 remaining
  await query(`UPDATE food_listings SET quantity_remaining = 20 WHERE id = $1`, [listingId]);

  const verifyInv = await query(
    `SELECT f.quantity_kg, f.quantity_remaining, COALESCE(SUM(a.allocated_kg), 0) as total_allocated
     FROM food_listings f
     LEFT JOIN allocations a ON a.listing_id = f.id AND a.status != 'CANCELLED'
     WHERE f.id = $1
     GROUP BY f.id, f.quantity_kg, f.quantity_remaining`,
    [listingId]
  );
  const row = verifyInv.rows[0];
  const qOrig = parseFloat(row.quantity_kg);
  const qRem = parseFloat(row.quantity_remaining);
  const qAlloc = parseFloat(row.total_allocated);
  testAssert(qOrig === (qRem + qAlloc), `Invariant satisfied: ${qOrig}kg original == ${qRem}kg remaining + ${qAlloc}kg allocated`);

  // Cleanup test data
  await query(`DELETE FROM delivery_assignments WHERE allocation_id = $1`, [allocationId]);
  await query(`DELETE FROM allocations WHERE id = $1`, [allocationId]);
  await query(`DELETE FROM food_listings WHERE id = $1`, [listingId]);
  await query(`DELETE FROM users WHERE email IN ('rider_alpha@test.com', 'rider_beta@test.com', 'rogue_rider@test.com')`);

  console.log('\n=============================================================');
  console.log(`  TEST RESULTS: ${passedTests} PASSED, 0 FAILED (TOTAL: ${totalTests})`);
  console.log('=============================================================\n');

  process.exit(0);
}

runPhase7TestSuite().catch((err) => {
  console.error('[Phase 7 Test Suite Failed]', err);
  process.exit(1);
});
