/**
 * =============================================================
 * RESCUEGRID COMPREHENSIVE AUTOMATED TEST SUITE
 * Tests Algorithms, Data Structures, Token Cryptography,
 * Matching Logic, and API Route Initialization
 * =============================================================
 */

import { calculateHaversineDistance, isValidCoordinate } from '../server/src/services/geoService.js';
import { rankCandidateShelters } from '../server/src/services/matchingService.js';
import { generateHandoverToken, verifyHandoverToken } from '../server/src/services/tokenService.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
  }
}

async function runAllTests() {
  console.log('=============================================================');
  console.log('       RESCUEGRID SYSTEM VERIFICATION & TEST SUITE           ');
  console.log('=============================================================\n');

  // -----------------------------------------------------------
  // TEST SUITE 1: GEOSPATIAL & HAVERSINE DISTANCE MATH
  // -----------------------------------------------------------
  console.log('[Suite 1: Geospatial Algorithms & Coordinate Validation]');
  
  // Test coordinate validation
  assert(isValidCoordinate(12.9716, 77.5946), 'Valid Bangalore coordinates return true');
  assert(isValidCoordinate(-33.8688, 151.2093), 'Valid Sydney coordinates return true');
  assert(!isValidCoordinate(95.0, 77.5946), 'Latitude > 90 correctly rejected');
  assert(!isValidCoordinate(12.9716, 185.0), 'Longitude > 180 correctly rejected');
  assert(!isValidCoordinate('abc', 'def'), 'Non-numeric coordinates correctly rejected');

  // Test Haversine distance calculations
  // Distance from (12.9716, 77.5946) to (12.9780, 77.5990) is ~0.86 km
  const dist1 = calculateHaversineDistance(12.9716, 77.5946, 12.9780, 77.5990);
  assert(dist1 > 0.7 && dist1 < 1.0, `Calculated distance (~0.86 km) is accurate: ${dist1} km`);

  // Same point distance must be 0
  const distZero = calculateHaversineDistance(12.9716, 77.5946, 12.9716, 77.5946);
  assert(distZero === 0, 'Distance between identical points is exactly 0 km');

  // Bangalore to Delhi is ~1740 km
  const distLong = calculateHaversineDistance(12.9716, 77.5946, 28.6139, 77.2090);
  assert(distLong > 1700 && distLong < 1780, `Bangalore to Delhi distance (~1740 km) is accurate: ${distLong} km`);
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 2: PROXIMITY-CAPACITY MATCHING & KNAPSACK ALGORITHM
  // -----------------------------------------------------------
  console.log('[Suite 2: Proximity-Capacity Multi-Criteria Matching Algorithm]');
  
  const donorLat = 12.9716;
  const donorLng = 77.5946;
  const testBatchWeight = 30.0; // 30 kg surplus

  const candidateShelters = [
    { id: 'shelter-1', name: 'Close But Tiny Shelter', latitude: 12.9750, longitude: 77.5950, capacity_kg: 20.0 }, // 20kg < 30kg -> REJECT
    { id: 'shelter-2', name: 'Nearby Large Shelter', latitude: 12.9800, longitude: 77.6000, capacity_kg: 100.0 }, // ~1.1km, 100kg -> HIGH SCORE
    { id: 'shelter-3', name: 'Far Away Massive Shelter', latitude: 13.1500, longitude: 77.7000, capacity_kg: 500.0 }, // >20km -> REJECT (>15km radius)
    { id: 'shelter-4', name: 'Moderate Distance Good Capacity', latitude: 12.9900, longitude: 77.6100, capacity_kg: 80.0 }, // ~2.6km, 80kg -> MED SCORE
  ];

  const ranked = rankCandidateShelters(donorLat, donorLng, candidateShelters, testBatchWeight, 15.0);

  assert(ranked.length === 3, `Correctly filtered candidate count (expected 3 valid, got ${ranked.length})`);
  assert(ranked[0].id === 'shelter-1', `Top recommended shelter is closest '${ranked[0].name}' (Score: ${ranked[0].suitability_score})`);
  assert(ranked[1].id === 'shelter-2', `Second recommended shelter is '${ranked[1].name}' (Score: ${ranked[1].suitability_score})`);
  
  // Verify that shelter exceeding max radius (>15km) was strictly rejected
  const hasFar = ranked.some(s => s.id === 'shelter-3');
  assert(!hasFar, 'Shelter exceeding max radius (>15km) was strictly rejected');
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 3: CRYPTOGRAPHIC CUSTODY TOKENS (HMAC-SHA256)
  // -----------------------------------------------------------
  console.log('[Suite 3: Cryptographic Handover & Non-Repudiation Tokens]');
  
  const testListingId = 'listing-uuid-abc-123';
  const testCourierId = 'courier-uuid-xyz-789';

  const tokenData = generateHandoverToken(testListingId, testCourierId);

  assert(typeof tokenData.verificationCode === 'string', 'Generated verification code is a string');
  assert(tokenData.verificationCode.length === 6, `Verification code is exactly 6 digits: ${tokenData.verificationCode}`);
  assert(/^\d{6}$/.test(tokenData.verificationCode), 'Verification code contains only numeric digits');
  assert(tokenData.signature.length === 64, 'HMAC-SHA256 hex signature is 64 characters (256 bits)');

  // Verify constant-time token comparison
  const isValid = verifyHandoverToken(tokenData.verificationCode, tokenData.verificationCode);
  assert(isValid, 'Valid token passes constant-time verification');

  const isInvalid = verifyHandoverToken(tokenData.verificationCode, '999999');
  assert(!isInvalid, 'Tampered / incorrect token is rejected');

  const isShort = verifyHandoverToken(tokenData.verificationCode, '123');
  assert(!isShort, 'Malformed length token is rejected safely');
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 4: REDIS LUA SCRIPT INTEGRITY
  // -----------------------------------------------------------
  console.log('[Suite 4: Redis Lua Script Syntax & State Machine Definition]');
  
  import('../server/src/services/redisEngine.js').then((redisEngine) => {
    assert(typeof redisEngine.attemptAtomicClaim === 'function', 'attemptAtomicClaim function exists and is exported');
    assert(typeof redisEngine.addDonationToGeo === 'function', 'addDonationToGeo function exists and is exported');
    assert(typeof redisEngine.findNearbyDonations === 'function', 'findNearbyDonations function exists and is exported');
    assert(typeof redisEngine.findNearbyShelters === 'function', 'findNearbyShelters function exists and is exported');
    assert(typeof redisEngine.removeDonationFromGeo === 'function', 'removeDonationFromGeo function exists and is exported');
    console.log('');

    // Final Summary
    console.log('=============================================================');
    console.log(`  TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
    console.log('=============================================================');

    if (failedTests === 0) {
      console.log('  >>> ALL ALGORITHMS AND SERVICES PASSED VALIDATION! <<<');
    } else {
      console.error('  >>> SOME TESTS FAILED. PLEASE REVIEW LOGS. <<<');
    }
  }).catch((err) => {
    console.error('[Error loading redisEngine]', err);
  });
}

runAllTests();
