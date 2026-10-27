/**
 * =============================================================
 * RESCUEGRID PHASE 2: MATCHING ENGINE UNIT TEST SUITE
 * Validates Hard Operational Feasibility Constraints,
 * Deadline Slack Calculations, Multi-Criteria Scoring,
 * and Baseline Comparison.
 * =============================================================
 */

import {
  calculateTransitAndSlack,
  evaluateCandidateFeasibility,
  scoreFeasibleCandidate,
  matchListingToRecipients,
  baselineNearestMatch,
} from '../server/src/services/matchingService.js';

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

async function runMatchingUnitTests() {
  console.log('=============================================================');
  console.log('  RESCUEGRID PHASE 2: MATCHING ENGINE COMPREHENSIVE SUITE   ');
  console.log('=============================================================\n');

  const donorLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore Center
  const now = new Date('2026-10-27T12:00:00Z').getTime();

  // Standard Test Listing
  const standardListing = {
    id: 'listing-001',
    pickup_lat: donorLocation.lat,
    pickup_lng: donorLocation.lng,
    quantity_kg: 25.0,
    category: 'COOKED_MEAL',
    dietary_type: 'VEG',
    safety_declared: true,
    pickup_deadline: new Date(now + 2 * 3600 * 1000).toISOString(),      // +2 hrs
    consumption_deadline: new Date(now + 4 * 3600 * 1000).toISOString(), // +4 hrs
  };

  // -----------------------------------------------------------
  // TEST SUITE 1: TRANSIT & DEADLINE SLACK ESTIMATION
  // -----------------------------------------------------------
  console.log('[Suite 1: Round-Trip Transit ETA & Deadline Slack Calculation]');

  // Recipient 5km away (~12 mins one way at 25km/h, 24 mins round-trip + 45m handling/buffer = ~69m total)
  const recipient5km = { lat: 13.0166, lng: 77.5946 };
  const transit5km = calculateTransitAndSlack(
    donorLocation.lat,
    donorLocation.lng,
    recipient5km.lat,
    recipient5km.lng,
    standardListing.consumption_deadline,
    standardListing.pickup_deadline,
    { now }
  );

  assert(transit5km.distance_km === 5.0, `Calculated distance is exact 5.0 km (got ${transit5km.distance_km})`);
  assert(transit5km.round_trip_eta_minutes === 24, `Round-trip driving is 24 mins (got ${transit5km.round_trip_eta_minutes})`);
  assert(transit5km.total_operation_minutes === 69, `Total operation with buffers is 69 mins (got ${transit5km.total_operation_minutes})`);
  assert(transit5km.feasible_pickup === true, 'Arrival at donor meets pickup deadline');
  assert(transit5km.feasible_consumption === true, 'Delivery completes before consumption deadline');
  assert(transit5km.consumption_slack_minutes === 171, `Consumption slack is 171 minutes (got ${transit5km.consumption_slack_minutes})`);
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 2: HARD FEASIBILITY FILTERS (STAGE A)
  // -----------------------------------------------------------
  console.log('[Suite 2: Hard Feasibility Constraints]');

  // Case 2.1: Compatible, verified, adequate capacity recipient
  const idealRecipient = {
    id: 'shelter-ideal',
    name: 'Ideal Hope Shelter',
    latitude: 12.9800,
    longitude: 77.6000,
    capacity_kg: 100.0,
    available_capacity_kg: 80.0,
    is_verified: true,
    can_collect: true,
    accepted_categories: ['COOKED_MEAL', 'BAKERY'],
    dietary_preference: 'VEG',
  };

  const evalIdeal = evaluateCandidateFeasibility(standardListing, idealRecipient, { now });
  assert(evalIdeal.feasible === true, 'Nearby compatible verified recipient is eligible');

  // Case 2.2: Category Incompatible (Scenario A: Nearest is NOT best)
  const nearbyIncompatible = {
    id: 'shelter-incompatible-cat',
    name: 'Nearby Packaged Goods Only Pantry',
    latitude: 12.9720,
    longitude: 77.5950, // Ultra close: 0.1 km away!
    capacity_kg: 200.0,
    available_capacity_kg: 150.0,
    is_verified: true,
    can_collect: true,
    accepted_categories: ['PACKAGED'], // Does NOT accept COOKED_MEAL
    dietary_preference: 'ANY',
  };

  const evalIncompatible = evaluateCandidateFeasibility(standardListing, nearbyIncompatible, { now });
  assert(evalIncompatible.feasible === false, 'Category-incompatible candidate strictly rejected despite proximity');
  assert(
    evalIncompatible.rejection_reasons.some((r) => r.includes('CATEGORY_INCOMPATIBLE')),
    'Rejection reason explicitly cites category incompatibility'
  );

  // Case 2.3: Dietary Incompatible (NON_VEG to VEG shelter)
  const nonVegListing = { ...standardListing, dietary_type: 'NON_VEG' };
  const vegShelter = {
    id: 'shelter-strict-veg',
    name: 'Strict Vegetarian Shelter',
    latitude: 12.9800,
    longitude: 77.6000,
    capacity_kg: 100.0,
    available_capacity_kg: 80.0,
    is_verified: true,
    can_collect: true,
    dietary_preference: 'VEG',
  };

  const evalDietary = evaluateCandidateFeasibility(nonVegListing, vegShelter, { now });
  assert(evalDietary.feasible === false, 'Non-veg donation to vegetarian shelter strictly rejected');
  assert(
    evalDietary.rejection_reasons.some((r) => r.includes('DIETARY_INCOMPATIBLE')),
    'Rejection reason explicitly cites dietary incompatibility'
  );

  // Case 2.4: Insufficient Capacity
  const smallShelter = {
    ...idealRecipient,
    id: 'shelter-small',
    available_capacity_kg: 10.0, // Only 10kg available < 25kg batch
  };
  const evalCapacity = evaluateCandidateFeasibility(standardListing, smallShelter, { now });
  assert(evalCapacity.feasible === false, 'Shelter with available capacity < batch quantity rejected');
  assert(
    evalCapacity.rejection_reasons.some((r) => r.includes('INSUFFICIENT_CAPACITY')),
    'Rejection reason explicitly cites insufficient capacity'
  );

  // Case 2.5: No Collection Capability (Scenario D: Self-pickup unavailable)
  const noVehicleShelter = {
    ...idealRecipient,
    id: 'shelter-no-vehicle',
    can_collect: false, // Cannot pick up!
  };
  const evalCollection = evaluateCandidateFeasibility(standardListing, noVehicleShelter, { now });
  assert(evalCollection.feasible === false, 'Recipient without self-pickup capability rejected');
  assert(
    evalCollection.rejection_reasons.includes('NO_COLLECTION_CAPABILITY'),
    'Rejection reason explicitly cites no collection capability'
  );

  // Case 2.6: Unverified Organization
  const unverifiedShelter = {
    ...idealRecipient,
    id: 'shelter-unverified',
    is_verified: false,
  };
  const evalVerified = evaluateCandidateFeasibility(standardListing, unverifiedShelter, { now });
  assert(evalVerified.feasible === false, 'Unverified shelter strictly rejected');
  assert(
    evalVerified.rejection_reasons.includes('RECIPIENT_NOT_VERIFIED'),
    'Rejection reason explicitly cites unverified status'
  );

  // Case 2.7: Time Infeasibility / Expired Deadline (Scenario C)
  const urgentListing = {
    ...standardListing,
    consumption_deadline: new Date(now + 30 * 60 * 1000).toISOString(), // 30 mins deadline!
  };
  // Recipient 10 km away requires ~24 mins travel + 45 mins handling = 69 mins > 30 mins deadline!
  const farRecipient = {
    ...idealRecipient,
    id: 'shelter-far',
    latitude: 13.0616,
    longitude: 77.5946, // 10 km away
  };
  const evalUrgent = evaluateCandidateFeasibility(urgentListing, farRecipient, { now });
  assert(evalUrgent.feasible === false, 'Candidate with negative deadline slack strictly rejected');
  assert(
    evalUrgent.rejection_reasons.some((r) => r.includes('CONSUMPTION_DEADLINE_INFEASIBLE')),
    'Rejection reason explicitly cites deadline infeasibility'
  );

  // Case 2.8: Unsafe food declaration
  const unsafeListing = { ...standardListing, safety_declared: false };
  const evalUnsafe = evaluateCandidateFeasibility(unsafeListing, idealRecipient, { now });
  assert(evalUnsafe.feasible === false, 'Listing without safety declaration rejected');
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 3: MULTI-CRITERIA SCORING & EXPLANATIONS (STAGE B)
  // -----------------------------------------------------------
  console.log('[Suite 3: Multi-Criteria Scoring & Human Explanations]');

  // Scenario B: Demand and Capacity Distinction
  // Candidate 1: Huge maximum capacity (500kg), 100kg available, no active request
  const recipientLarge = {
    id: 'shelter-large',
    name: 'Mega Refuge',
    latitude: 12.9800,
    longitude: 77.6000,
    capacity_kg: 500.0,
    available_capacity_kg: 100.0,
    is_verified: true,
    can_collect: true,
    has_active_request: false,
  };

  // Candidate 2: Moderate capacity (50kg), 30kg available, HAS active urgent request
  const recipientTargeted = {
    id: 'shelter-targeted',
    name: 'Community Relief Center',
    latitude: 12.9800,
    longitude: 77.6000, // Same distance!
    capacity_kg: 50.0,
    available_capacity_kg: 30.0,
    is_verified: true,
    can_collect: true,
    has_active_request: true, // Urgent recorded demand
  };

  const matchResult = matchListingToRecipients(
    standardListing,
    [recipientLarge, recipientTargeted],
    { now }
  );

  assert(matchResult.feasible_count === 2, 'Both candidates are feasible');
  assert(
    matchResult.recommendations[0].recipient_id === 'shelter-targeted',
    `Recipient with active demand and tighter fit ranks HIGHER (${matchResult.recommendations[0].total_score} vs ${matchResult.recommendations[1].total_score})`
  );
  assert(
    matchResult.recommendations[0].explanation.summary.length > 20,
    'Explanation contains human-readable justification summary'
  );
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 4: BASELINE COMPARISON ON COMPLEX SCENARIO
  // -----------------------------------------------------------
  console.log('[Suite 4: Proposed vs Baseline Comparison on Tricky Scenario]');

  // Tricky scenario:
  // - Candidate A: 0.5 km away, but INCOMPATIBLE category (Packaged only).
  // - Candidate B: 2.0 km away, compatible, 30kg capacity, active demand.
  // - Candidate C: 12.0 km away, compatible, 200kg capacity.
  const candidatesTricky = [
    nearbyIncompatible, // 0.1km, rejected
    recipientTargeted,  // ~1.1km, feasible, high need
    farRecipient,       // 10km, feasible on standard listing
  ];

  const proposedOutput = matchListingToRecipients(standardListing, candidatesTricky, { now });
  const baselineOutput = baselineNearestMatch(standardListing, candidatesTricky, { now });

  assert(
    proposedOutput.feasible_count === 2,
    `Proposed filtered 1 invalid candidate (feasible: ${proposedOutput.feasible_count}, rejected: ${proposedOutput.rejected_count})`
  );
  assert(
    baselineOutput.feasible_count === 2,
    `Baseline filtered identical 1 invalid candidate (feasible: ${baselineOutput.feasible_count})`
  );
  assert(
    proposedOutput.recommendations[0].recipient_id === 'shelter-targeted',
    'Both algorithms select the feasible candidate over the incompatible nearest'
  );

  // Test empty candidates
  const emptyOutput = matchListingToRecipients(standardListing, [], { now });
  assert(emptyOutput.feasible_count === 0, 'Empty candidate set returns 0 feasible recommendations');
  console.log('');

  // -----------------------------------------------------------
  // TEST SUITE 5: DETERMINISTIC TIE-BREAKING
  // -----------------------------------------------------------
  console.log('[Suite 5: Deterministic Tie-Breaking]');

  const twinA = { ...recipientLarge, id: 'shelter-twin-a', name: 'Twin Shelter A' };
  const twinB = { ...recipientLarge, id: 'shelter-twin-b', name: 'Twin Shelter B' };

  const tieRun1 = matchListingToRecipients(standardListing, [twinA, twinB], { now });
  const tieRun2 = matchListingToRecipients(standardListing, [twinB, twinA], { now });

  assert(
    tieRun1.recommendations[0].recipient_id === tieRun2.recommendations[0].recipient_id,
    `Identical inputs in reverse order produce identical ranking order: '${tieRun1.recommendations[0].recipient_id}'`
  );
  console.log('');

  // ===========================================================
  // SUMMARY
  // ===========================================================
  console.log('=============================================================');
  console.log(`  MATCHING TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('=============================================================');

  if (failedTests === 0) {
    console.log('  >>> ALL DEADLINE-AWARE MATCHING TESTS PASSED 100%! <<<\n');
  } else {
    console.error('  >>> SOME TESTS FAILED. PLEASE REVIEW LOGS. <<<\n');
    process.exit(1);
  }
}

runMatchingUnitTests();
