import { calculateHaversineDistance } from './geoService.js';

/**
 * =============================================================
 * RESCUEGRID DEADLINE-AWARE & CAPACITY-AWARE MATCHING ENGINE
 * 
 * Two-Stage Deterministic Architecture:
 * Stage A: Hard Feasibility Filters (Strict operational constraints)
 * Stage B: Multi-Criteria Explainable Ranking (Deterministic scoring)
 * 
 * Includes Nearest-Feasible Baseline for comparative evaluation.
 * =============================================================
 */

// Default operational parameters for urban self-pickup
export const DEFAULT_MATCHING_CONFIG = {
  average_transit_speed_kmh: 25.0, // 25 km/h urban vehicle average speed
  pickup_handling_minutes: 15.0,    // 15 mins for inspection and vehicle loading
  delivery_handling_minutes: 15.0,  // 15 mins for shelter offloading and check-in
  safety_buffer_minutes: 15.0,      // 15 mins general traffic/operational slack buffer
  max_radius_km: 25.0,             // 25 km outer boundary
  weights: {
    travel: 0.30,   // Proximity & transit time efficiency
    slack: 0.30,    // Urgency & safe time margin
    fit: 0.25,      // Capacity & quantity alignment
    need: 0.15,     // Active demand priority
  },
};

/**
 * Calculates transit times, round-trip requirements, and deadline slacks.
 * 
 * Round-trip model for Recipient Self-Pickup:
 * 1. Outward trip: Recipient -> Donor (distance_km / avg_speed)
 * 2. Pickup handling at Donor (15 mins)
 * 3. Return trip: Donor -> Recipient (distance_km / avg_speed)
 * 4. Offloading / handling at Recipient (15 mins)
 * 5. General safety buffer (15 mins)
 */
export function calculateTransitAndSlack(
  donorLat,
  donorLng,
  recipientLat,
  recipientLng,
  consumptionDeadline,
  pickupDeadline,
  options = {}
) {
  const cfg = { ...DEFAULT_MATCHING_CONFIG, ...options };
  const distKm = calculateHaversineDistance(donorLat, donorLng, recipientLat, recipientLng);

  // Speed in km per minute
  const speedKmPerMin = cfg.average_transit_speed_kmh / 60.0;
  const oneWayTravelMins = distKm / speedKmPerMin;
  const roundTripTravelMins = oneWayTravelMins * 2.0;

  const totalTransitMins =
    roundTripTravelMins +
    cfg.pickup_handling_minutes +
    cfg.delivery_handling_minutes +
    cfg.safety_buffer_minutes;

  const now = options.now ? new Date(options.now).getTime() : Date.now();
  const arrivalAtDonorTime = now + (oneWayTravelMins + cfg.pickup_handling_minutes) * 60 * 1000;
  const deliveryCompletionTime = now + totalTransitMins * 60 * 1000;

  const pickupCutoff = pickupDeadline ? new Date(pickupDeadline).getTime() : now + 7200 * 1000;
  const consumptionCutoff = consumptionDeadline
    ? new Date(consumptionDeadline).getTime()
    : pickupCutoff + 7200 * 1000;

  // Slacks in minutes
  const pickupSlackMinutes = (pickupCutoff - arrivalAtDonorTime) / (60 * 1000);
  const consumptionSlackMinutes = (consumptionCutoff - deliveryCompletionTime) / (60 * 1000);

  return {
    distance_km: parseFloat(distKm.toFixed(2)),
    one_way_eta_minutes: Math.ceil(oneWayTravelMins),
    round_trip_eta_minutes: Math.ceil(roundTripTravelMins),
    total_operation_minutes: Math.ceil(totalTransitMins),
    pickup_slack_minutes: Math.round(pickupSlackMinutes),
    consumption_slack_minutes: Math.round(consumptionSlackMinutes),
    estimated_arrival_at_donor: new Date(arrivalAtDonorTime).toISOString(),
    estimated_delivery_completion: new Date(deliveryCompletionTime).toISOString(),
    feasible_pickup: pickupSlackMinutes >= 0,
    feasible_consumption: consumptionSlackMinutes >= 0,
  };
}

/**
 * Stage A: Hard Feasibility Filters
 * Strictly rejects any recipient that cannot safely or feasibly handle the donation.
 */
export function evaluateCandidateFeasibility(listing, recipient, options = {}) {
  const rejectionReasons = [];

  // 1. Verification filter: Recipient must be verified
  if (recipient.is_verified === false) {
    rejectionReasons.push('RECIPIENT_NOT_VERIFIED');
  }

  // 2. Collection capability filter (Self-pickup model)
  if (recipient.can_collect === false) {
    rejectionReasons.push('NO_COLLECTION_CAPABILITY');
  }

  // 3. Coordinate validity
  const donorLat = parseFloat(listing.pickup_lat);
  const donorLng = parseFloat(listing.pickup_lng);
  const recipLat = parseFloat(recipient.latitude);
  const recipLng = parseFloat(recipient.longitude);

  if (isNaN(donorLat) || isNaN(donorLng) || isNaN(recipLat) || isNaN(recipLng)) {
    rejectionReasons.push('INVALID_COORDINATES');
    return { feasible: false, rejection_reasons: rejectionReasons, transit: null };
  }

  // 4. Batch quantity and capacity constraints
  const batchQty = parseFloat(listing.quantity_kg);
  const availCap = parseFloat(
    recipient.available_capacity_kg !== undefined
      ? recipient.available_capacity_kg
      : recipient.capacity_kg
  );

  if (isNaN(batchQty) || batchQty <= 0) {
    rejectionReasons.push('INVALID_BATCH_QUANTITY');
  }

  if (isNaN(availCap) || availCap < batchQty) {
    rejectionReasons.push(`INSUFFICIENT_CAPACITY: available ${availCap || 0}kg < required ${batchQty}kg`);
  }

  // 5. Food Category Compatibility
  const foodCategory = listing.category || 'COOKED_MEAL';
  if (recipient.accepted_categories && Array.isArray(recipient.accepted_categories)) {
    if (!recipient.accepted_categories.includes(foodCategory) && !recipient.accepted_categories.includes('ALL')) {
      rejectionReasons.push(`CATEGORY_INCOMPATIBLE: listing is ${foodCategory}`);
    }
  }

  // 6. Dietary Restriction Compatibility
  const listingDiet = (listing.dietary_type || 'VEG').toUpperCase();
  const recipientDiet = recipient.dietary_preference || recipient.dietary_type || 'ANY';

  if (recipientDiet !== 'ANY') {
    if (recipientDiet === 'VEGAN' && listingDiet !== 'VEGAN') {
      rejectionReasons.push(`DIETARY_INCOMPATIBLE: requires VEGAN, listing is ${listingDiet}`);
    } else if (recipientDiet === 'VEG' && listingDiet === 'NON_VEG') {
      rejectionReasons.push(`DIETARY_INCOMPATIBLE: requires VEG, listing is ${listingDiet}`);
    }
  }

  // 7. Food Safety declaration check
  if (listing.safety_declared === false) {
    rejectionReasons.push('FOOD_SAFETY_NOT_DECLARED');
  }

  // 8. Distance and Deadline Transit Calculation
  const transit = calculateTransitAndSlack(
    donorLat,
    donorLng,
    recipLat,
    recipLng,
    listing.consumption_deadline || listing.expires_at,
    listing.pickup_deadline || listing.expires_at,
    options
  );

  const maxRadius = options.max_radius_km || DEFAULT_MATCHING_CONFIG.max_radius_km;
  if (transit.distance_km > maxRadius) {
    rejectionReasons.push(`DISTANCE_EXCEEDED: ${transit.distance_km}km > ${maxRadius}km`);
  }

  if (!transit.feasible_pickup) {
    rejectionReasons.push(
      `PICKUP_DEADLINE_INFEASIBLE: arrival at donor would miss pickup cutoff by ${Math.abs(transit.pickup_slack_minutes)} mins`
    );
  }

  if (!transit.feasible_consumption) {
    rejectionReasons.push(
      `CONSUMPTION_DEADLINE_INFEASIBLE: negative slack of ${transit.consumption_slack_minutes} mins`
    );
  }

  return {
    feasible: rejectionReasons.length === 0,
    rejection_reasons: rejectionReasons,
    transit,
  };
}

/**
 * Stage B: Multi-Criteria Scoring & Human-Readable Explanation
 */
export function scoreFeasibleCandidate(listing, recipient, transit, options = {}) {
  const cfg = { ...DEFAULT_MATCHING_CONFIG, ...options };
  const weights = options.weights || cfg.weights;

  const maxRadius = options.max_radius_km || cfg.max_radius_km;
  const batchQty = parseFloat(listing.quantity_kg);
  const availCap = parseFloat(
    recipient.available_capacity_kg !== undefined
      ? recipient.available_capacity_kg
      : recipient.capacity_kg
  );

  // 1. Travel Score (0 to 1): 1 for closest, 0 at max radius
  const travelScore = Math.max(0, Math.min(1, 1 - transit.distance_km / maxRadius));

  // 2. Deadline Slack Score (0 to 1):
  // Measures safe cushion. 120+ minutes of slack is ideal (1.0).
  const slackScore = Math.max(0, Math.min(1, transit.consumption_slack_minutes / 180.0));

  // 3. Capacity Fit Score (0 to 1):
  // Ideal fit is when batch fills a good portion of capacity without overflowing.
  const fitRatio = availCap > 0 ? batchQty / availCap : 0;
  const fitScore = Math.max(0, Math.min(1, fitRatio > 1 ? 0 : 0.5 + 0.5 * fitRatio));

  // 4. Need / Priority Score (0 to 1):
  // Higher score if recipient has recorded active demand
  const hasActiveDemand = recipient.has_active_request || recipient.active_request_id ? 1.0 : 0.6;
  const needScore = hasActiveDemand;

  // Composite Weighted Score
  const totalScore = parseFloat(
    (
      weights.travel * travelScore +
      weights.slack * slackScore +
      weights.fit * fitScore +
      weights.need * needScore
    ).toFixed(4)
  );

  // Construct transparent explanation
  const explanation = {
    distance_km: transit.distance_km,
    round_trip_eta_minutes: transit.round_trip_eta_minutes,
    deadline_slack_minutes: transit.consumption_slack_minutes,
    available_capacity_kg: availCap,
    batch_quantity_kg: batchQty,
    dietary_compatibility: 'COMPATIBLE',
    summary: `Feasible self-pickup (${transit.distance_km}km, ${transit.round_trip_eta_minutes}m round-trip). Offers ${transit.consumption_slack_minutes}m buffer before consumption cutoff with ${availCap}kg available storage.`,
  };

  return {
    recipient_id: recipient.id,
    recipient_name: recipient.name,
    latitude: recipient.latitude,
    longitude: recipient.longitude,
    total_score: totalScore,
    score_breakdown: {
      travel_score: parseFloat(travelScore.toFixed(3)),
      slack_score: parseFloat(slackScore.toFixed(3)),
      capacity_fit_score: parseFloat(fitScore.toFixed(3)),
      need_priority_score: parseFloat(needScore.toFixed(3)),
    },
    transit_details: transit,
    explanation,
  };
}

/**
 * Main Matching Function: Evaluates all candidates through Stage A and Stage B.
 */
export function matchListingToRecipients(listing, candidateRecipients = [], options = {}) {
  const feasibleRecommendations = [];
  const rejectedCandidates = [];

  for (const candidate of candidateRecipients) {
    const evaluation = evaluateCandidateFeasibility(listing, candidate, options);

    if (evaluation.feasible) {
      const scored = scoreFeasibleCandidate(listing, candidate, evaluation.transit, options);
      feasibleRecommendations.push(scored);
    } else {
      rejectedCandidates.push({
        recipient_id: candidate.id,
        recipient_name: candidate.name,
        rejection_reasons: evaluation.rejection_reasons,
        transit: evaluation.transit,
      });
    }
  }

  // Deterministic tie-breaking: primary by total_score desc, secondary by distance asc, tertiary by recipient_id
  feasibleRecommendations.sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    if (a.transit_details.distance_km !== b.transit_details.distance_km) {
      return a.transit_details.distance_km - b.transit_details.distance_km;
    }
    return (a.recipient_id || '').localeCompare(b.recipient_id || '');
  });

  return {
    listing_id: listing.id,
    total_candidates_evaluated: candidateRecipients.length,
    feasible_count: feasibleRecommendations.length,
    rejected_count: rejectedCandidates.length,
    recommendations: feasibleRecommendations,
    rejected: rejectedCandidates,
  };
}

/**
 * Baseline Matcher: Nearest-Feasible Recipient.
 * Evaluates the EXACT same hard constraints as the proposed engine,
 * but ranks purely by minimum physical distance.
 */
export function baselineNearestMatch(listing, candidateRecipients = [], options = {}) {
  const feasible = [];
  const rejected = [];

  for (const candidate of candidateRecipients) {
    const evaluation = evaluateCandidateFeasibility(listing, candidate, options);

    if (evaluation.feasible) {
      feasible.push({
        recipient_id: candidate.id,
        recipient_name: candidate.name,
        distance_km: evaluation.transit.distance_km,
        transit_details: evaluation.transit,
        method: 'BASELINE_NEAREST_FEASIBLE',
      });
    } else {
      rejected.push({
        recipient_id: candidate.id,
        recipient_name: candidate.name,
        rejection_reasons: evaluation.rejection_reasons,
      });
    }
  }

  // Rank purely by distance ascending
  feasible.sort((a, b) => {
    if (a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }
    return (a.recipient_id || '').localeCompare(b.recipient_id || '');
  });

  return {
    listing_id: listing.id,
    method: 'BASELINE_NEAREST_FEASIBLE',
    feasible_count: feasible.length,
    rejected_count: rejected.length,
    recommendations: feasible,
    rejected,
  };
}

/**
 * Backward compatibility wrapper for existing tests/controllers.
 */
export function rankCandidateShelters(
  donorLat,
  donorLng,
  candidateShelters,
  batchWeightKg,
  maxRadiusKm = 15.0
) {
  const syntheticListing = {
    pickup_lat: donorLat,
    pickup_lng: donorLng,
    quantity_kg: batchWeightKg,
    category: 'COOKED_MEAL',
    dietary_type: 'VEG',
    safety_declared: true,
    pickup_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    consumption_deadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  };

  const results = matchListingToRecipients(syntheticListing, candidateShelters, {
    max_radius_km: maxRadiusKm,
  });

  return results.recommendations.map((r) => ({
    ...candidateShelters.find((s) => s.id === r.recipient_id),
    distance_km: r.transit_details.distance_km,
    suitability_score: r.total_score,
    explanation: r.explanation,
  }));
}
