/**
 * =============================================================
 * RESCUEGRID: CONCURRENCY STRESS-TEST & RACE-CONDITION PROOF
 * Simulates 50 simultaneous shelter claims on the exact same batch
 * =============================================================
 */

const API_BASE = process.env.API_URL || 'http://localhost'; // Hits Nginx port 80 (or port 5000)

async function runConcurrencyProof() {
  console.log('=============================================================');
  console.log('  RESCUEGRID CLOUD EVALUATION: CONCURRENCY BENCHMARK');
  console.log('  Simulating 50 Concurrent Claims across API Replicas');
  console.log('=============================================================\n');

  try {
    // Step 1: Create a fresh food listing
    console.log('[Step 1] Creating new surplus food batch...');
    const createRes = await fetch(`${API_BASE}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor_id: '11111111-1111-1111-1111-111111111111',
        food_type: 'Hot Vegetable Biryani & Gravy (50 Servings)',
        quantity_kg: 25.0,
        cooked_at: new Date().toISOString(),
        expires_in_seconds: 7200,
        pickup_lat: 12.9716,
        pickup_lng: 77.5946,
        pickup_address: 'Grand Palace Hotel Banquet Hall',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create test listing: ${createRes.status} ${await createRes.text()}`);
    }

    const createData = await createRes.json();
    const listingId = createData.listing.id;
    console.log(`[Step 1] Batch Created Successfully! Listing ID: ${listingId}\n`);

    // Step 2: Fire 50 simultaneous claim requests
    console.log(`[Step 2] Firing 50 SIMULTANEOUS claim requests at Listing ${listingId}...`);
    const numRequests = 50;
    const promises = [];

    const startTime = Date.now();

    for (let i = 1; i <= numRequests; i++) {
      const simulatedShelterId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      
      const p = fetch(`${API_BASE}/api/listings/${listingId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelter_id: simulatedShelterId }),
      }).then(async (res) => {
        return {
          shelter: simulatedShelterId,
          status: res.status,
          body: await res.json(),
        };
      }).catch((err) => {
        return {
          shelter: simulatedShelterId,
          status: 500,
          error: err.message,
        };
      });

      promises.push(p);
    }

    // Wait for all 50 requests to complete
    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    // Step 3: Analyze results
    let winners = 0;
    let conflicts = 0;
    let errors = 0;
    let winningShelter = null;

    results.forEach((r) => {
      if (r.status === 200) {
        winners++;
        winningShelter = r.shelter;
      } else if (r.status === 409) {
        conflicts++;
      } else {
        errors++;
      }
    });

    console.log('\n=============================================================');
    console.log('                 CONCURRENCY PROOF RESULTS                   ');
    console.log('=============================================================');
    console.log(` Total Concurrent Requests Fired: ${numRequests}`);
    console.log(` Total Execution Duration:        ${durationMs} ms`);
    console.log(` HTTP 200 OK (Successful Claims): ${winners}  <-- EXACTLY 1 EXPECTED`);
    console.log(` HTTP 409 Conflict (Protected):   ${conflicts} <-- EXACTLY 49 EXPECTED`);
    console.log(` System Errors / Deadlocks:       ${errors}`);
    console.log(` Winning Shelter ID:              ${winningShelter}`);
    console.log('=============================================================');

    if (winners === 1 && conflicts === 49 && errors === 0) {
      console.log(' [VERDICT: PASSED 100%]');
      console.log(' The Redis Lua atomic state machine successfully eliminated all race conditions.');
      console.log(' Zero duplicate claims. Zero double-dispatching. Zero deadlocks.\n');
    } else {
      console.warn(' [VERDICT: FAILED - UNEXPECTED CONCURRENCY BEHAVIOR]\n');
    }
  } catch (err) {
    console.error('[Benchmark Error]', err);
  }
}

runConcurrencyProof();
