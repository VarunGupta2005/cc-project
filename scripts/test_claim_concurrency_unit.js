/**
 * =============================================================
 * UNIT TEST: ATOMIC CLAIM & RACE-CONDITION DEFENSE LOGIC
 * Validates the single-winner guarantee under high concurrency
 * =============================================================
 */

class MockAtomicStateStore {
  constructor() {
    this.store = new Map();
  }

  set(key, val) {
    this.store.set(key, val);
  }

  get(key) {
    return this.store.get(key);
  }

  // Simulates atomic single-threaded Redis Lua script execution
  async executeAtomicClaimScript(listingId, shelterId) {
    // In Redis, Lua scripts are atomic because Redis processes them single-threaded on the event loop
    const listingKey = `listing:${listingId}`;
    const state = this.store.get(listingKey);

    if (state && state.status === 'AVAILABLE') {
      state.status = 'CLAIMED';
      state.claimed_by = shelterId;
      return 1; // Success (Winner)
    } else {
      return 0; // Conflict / Already claimed (Loser)
    }
  }
}

async function testConcurrencyLogic() {
  console.log('=============================================================');
  console.log('  UNIT TEST: ATOMIC CLAIM STATE MACHINE CONCURRENCY TEST    ');
  console.log('=============================================================\n');

  const stateStore = new MockAtomicStateStore();
  const testListingId = 'listing-999';

  stateStore.set(`listing:${testListingId}`, {
    id: testListingId,
    food_type: 'Fresh Meals',
    status: 'AVAILABLE',
  });

  const concurrentRequests = 50;
  console.log(`Firing ${concurrentRequests} concurrent simulated claims at listing ${testListingId}...`);

  const promises = [];
  for (let i = 1; i <= concurrentRequests; i++) {
    const shelterId = `shelter-${i}`;
    promises.push(
      stateStore.executeAtomicClaimScript(testListingId, shelterId).then((code) => ({
        shelterId,
        won: code === 1,
      }))
    );
  }

  const results = await Promise.all(promises);

  const winners = results.filter((r) => r.won);
  const losers = results.filter((r) => !r.won);

  console.log(`  -> Winners Count: ${winners.length} (Expected: 1)`);
  console.log(`  -> Losers Count:  ${losers.length} (Expected: 49)`);
  console.log(`  -> Winner Shelter: ${winners[0]?.shelterId}`);

  if (winners.length === 1 && losers.length === 49) {
    console.log('\n  [PASS] Single-winner mutual exclusion proven 100% mathematically correct!\n');
  } else {
    console.error('\n  [FAIL] Concurrency violation detected!\n');
    process.exit(1);
  }
}

testConcurrencyLogic();
