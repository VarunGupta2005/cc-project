import { calculateHaversineDistance } from './geoService.js';

/**
 * Ranks candidate shelters based on distance and available storage capacity.
 * 
 * Formula:
 * Score(S) = w1 * (1 - Dist / MaxRadius) + w2 * ((Capacity - Weight) / Capacity)
 */
export function rankCandidateShelters(donorLat, donorLng, candidateShelters, batchWeightKg, maxRadiusKm = 10) {
  const w1 = 0.6; // Distance weight
  const w2 = 0.4; // Capacity headroom weight

  const scoredShelters = [];

  for (const shelter of candidateShelters) {
    const shelterLat = parseFloat(shelter.latitude);
    const shelterLng = parseFloat(shelter.longitude);
    const capacityKg = parseFloat(shelter.capacity_kg || 100);

    // Strict constraint: Shelter must have enough capacity
    if (capacityKg < batchWeightKg) {
      continue;
    }

    const dist = calculateHaversineDistance(donorLat, donorLng, shelterLat, shelterLng);

    // Strict constraint: Must be within perishability radius
    if (dist > maxRadiusKm) {
      continue;
    }

    const distanceScore = Math.max(0, 1 - dist / maxRadiusKm);
    const capacityScore = (capacityKg - batchWeightKg) / capacityKg;

    const totalScore = parseFloat((w1 * distanceScore + w2 * capacityScore).toFixed(4));

    scoredShelters.push({
      ...shelter,
      distance_km: dist,
      suitability_score: totalScore,
    });
  }

  // Sort descending by highest score
  return scoredShelters.sort((a, b) => b.suitability_score - a.suitability_score);
}
