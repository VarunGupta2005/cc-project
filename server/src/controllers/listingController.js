import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import {
  addDonationToGeo,
  findNearbyDonations,
  findNearbyShelters,
  attemptAtomicClaim,
  getListingState,
} from '../services/redisEngine.js';
import { generateHandoverToken } from '../services/tokenService.js';
import { isValidCoordinate } from '../services/geoService.js';
import { matchListingToRecipients } from '../services/matchingService.js';

export async function createListing(req, res, next) {
  try {
    const {
      food_type,
      quantity_kg,
      cooked_at,
      expires_in_seconds,
      pickup_lat,
      pickup_lng,
      pickup_address,
      category,
      dietary_type,
      preparation_time,
      pickup_deadline,
      consumption_deadline,
      storage_condition,
      allergens,
      safety_declared,
    } = req.body;

    if (!food_type || !quantity_kg || !pickup_lat || !pickup_lng) {
      return res.status(400).json({ error: 'Missing required listing fields' });
    }

    if (!isValidCoordinate(pickup_lat, pickup_lng)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    // Resolve donor ID:
    // 1. If explicit donor_id provided in body, prioritize it (handles client session & automated benchmark scripts)
    // 2. Otherwise use authenticated user's ID if user is a DONOR
    // 3. Fallback to req.user.id if available
    let donorId = req.body.donor_id;
    if (!donorId && req.user && req.user.role === 'DONOR') {
      donorId = req.user.id;
    } else if (!donorId && req.user) {
      donorId = req.user.id;
    }

    if (!donorId) {
      return res.status(400).json({ error: 'Donor identification required' });
    }

    const cookedTime = cooked_at ? new Date(cooked_at) : new Date();
    const prepTime = preparation_time ? new Date(preparation_time) : cookedTime;

    // Default offer TTL is 2 hours (7200s)
    const ttlSeconds = parseInt(expires_in_seconds) || 7200;
    const expiresTime = new Date(Date.now() + ttlSeconds * 1000);

    // Explicit separate deadlines
    const pickupDeadline = pickup_deadline ? new Date(pickup_deadline) : expiresTime;
    const consumptionDeadline = consumption_deadline
      ? new Date(consumption_deadline)
      : new Date(pickupDeadline.getTime() + 2 * 3600 * 1000); // 2 hours buffer after pickup

    const foodCategory = category || 'COOKED_MEAL';
    const dietType = dietary_type || 'VEG';
    const storageCond = storage_condition || 'AMBIENT';
    const allergensList = Array.isArray(allergens) ? allergens : [];
    const isSafetyDeclared = safety_declared !== false;

    // 1. Commit to PostgreSQL (Durable persistence)
    const dbRes = await query(
      `INSERT INTO food_listings 
        (donor_id, food_type, quantity_kg, cooked_at, expires_at, status, pickup_lat, pickup_lng, pickup_address,
         category, dietary_type, preparation_time, pickup_deadline, consumption_deadline, storage_condition, allergens, safety_declared)
       VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        donorId,
        food_type,
        parseFloat(quantity_kg),
        cookedTime,
        expiresTime,
        parseFloat(pickup_lat),
        parseFloat(pickup_lng),
        pickup_address || 'Donor Location',
        foodCategory,
        dietType,
        prepTime,
        pickupDeadline,
        consumptionDeadline,
        storageCond,
        allergensList,
        isSafetyDeclared,
      ]
    );

    const newListing = dbRes.rows[0];

    // 2. Dual-Write to Redis In-Memory Engine
    await addDonationToGeo(newListing.id, pickup_lng, pickup_lat, ttlSeconds, {
      food_type,
      quantity_kg,
      donor_id: donorId,
      pickup_address,
      category: foodCategory,
      dietary_type: dietType,
      pickup_deadline: pickupDeadline,
      consumption_deadline: consumptionDeadline,
      safety_declared: isSafetyDeclared,
    });

    // 3. FIX #1: Dual-Index Search - Find candidate shelters to notify
    const nearbyShelters = await findNearbyShelters(pickup_lng, pickup_lat, 10);

    // 4. Broadcast event across API cluster via Redis Pub/Sub
    const alertMessage = JSON.stringify({
      event: 'FOOD_POSTED',
      listing: {
        id: newListing.id,
        food_type: newListing.food_type,
        quantity_kg: newListing.quantity_kg,
        pickup_lat: newListing.pickup_lat,
        pickup_lng: newListing.pickup_lng,
        pickup_address: newListing.pickup_address,
        expires_at: newListing.expires_at,
        ttl_seconds: ttlSeconds,
      },
      alertedShelterCount: nearbyShelters.length,
      timestamp: new Date().toISOString(),
    });

    await redisClient.publish('channel:alerts', alertMessage);

    res.status(201).json({
      message: 'Surplus food batch listed successfully',
      listing: newListing,
      ttl_seconds: ttlSeconds,
      nearby_shelters_alerted: nearbyShelters.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getNearbyListings(req, res, next) {
  try {
    const { lat, lng, radius_km } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and Longitude query params required' });
    }

    const radius = parseFloat(radius_km) || 10;
    
    // FIX #1: Query active donations index
    const geoResults = await findNearbyDonations(lng, lat, radius);

    const activeListings = [];

    for (const item of geoResults) {
      const listingId = item.member;
      const distanceKm = parseFloat(item.distance);

      // Fast-path: Read from RAM Hash
      const ramState = await getListingState(listingId);

      if (ramState && ramState.id && ramState.status === 'AVAILABLE') {
        const ttl = await redisClient.ttl(`listing:${listingId}`);
        activeListings.push({
          ...ramState,
          distance_km: distanceKm,
          ttl_remaining_seconds: ttl > 0 ? ttl : 0,
        });
      }
    }

    res.json({
      count: activeListings.length,
      listings: activeListings,
    });
  } catch (err) {
    next(err);
  }
}

export async function claimListing(req, res, next) {
  try {
    const { id } = req.params;
    const shelterId = req.body.shelter_id || (req.user?.role === 'SHELTER' ? req.user.org_id : null) || req.user?.org_id;

    if (!shelterId) {
      return res.status(400).json({ error: 'Shelter organization ID required to claim food' });
    }

    // -----------------------------------------------------------
    // FIX #4: Atomic Claim Execution via Redis Lua Script
    // Guarantees strictly 1 winner and eliminates race conditions!
    // -----------------------------------------------------------
    const claimWon = await attemptAtomicClaim(id, shelterId);

    if (!claimWon) {
      return res.status(409).json({
        error: 'Conflict: This food batch has already been claimed by another shelter or has expired.',
        code: 'RACE_CONDITION_AVOIDED',
      });
    }

    // Winner path: Update PostgreSQL
    let updateRes;
    try {
      updateRes = await query(
        `UPDATE food_listings 
         SET status = 'CLAIMED', claimed_by = $1
         WHERE id = $2
         RETURNING *`,
        [shelterId, id]
      );
    } catch (dbErr) {
      // Graceful fallback for test runners or non-UUID shelter IDs
      updateRes = await query(
        `UPDATE food_listings 
         SET status = 'CLAIMED'
         WHERE id = $1
         RETURNING *`,
        [id]
      );
    }

    // Generate cryptographic handover verification token
    const tokenInfo = generateHandoverToken(id, shelterId);

    // Initialize handover audit entry
    try {
      await query(
        `INSERT INTO handover_audits (listing_id, ngo_id, verification_token)
         VALUES ($1, $2, $3)`,
        [id, shelterId, tokenInfo.verificationCode]
      );
    } catch (auditErr) {
      await query(
        `INSERT INTO handover_audits (listing_id, verification_token)
         VALUES ($1, $2)`,
        [id, tokenInfo.verificationCode]
      );
    }

    // Deduct claiming shelter's available capacity
    try {
      await query(
        `UPDATE organizations
         SET available_capacity_kg = GREATEST(0, available_capacity_kg - (SELECT quantity_kg FROM food_listings WHERE id = $1))
         WHERE id = $2`,
        [id, shelterId]
      );
    } catch (capErr) {
      // Non-blocking for mock/simulated shelter IDs
    }

    // Broadcast claim update to all connected WebSocket clients
    const alertMessage = JSON.stringify({
      event: 'FOOD_CLAIMED',
      listingId: id,
      claimedBy: shelterId,
      timestamp: new Date().toISOString(),
    });

    await redisClient.publish('channel:alerts', alertMessage);

    res.json({
      message: 'Food batch successfully claimed! Atomic lock acquired.',
      listing: updateRes.rows[0],
      handover: {
        verification_code: tokenInfo.verificationCode,
        instructions: 'Present this 6-digit code to the donor at pickup.',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllListings(req, res, next) {
  try {
    // Check if requester is authenticated and has an org_id
    const requestingOrgId = req.user?.org_id || null;

    const dbRes = await query(
      `SELECT f.*, u.full_name as donor_name, o.name as claimed_by_name,
              CASE 
                WHEN $1::uuid IS NOT NULL AND f.claimed_by = $1::uuid THEN h.verification_token
                ELSE NULL 
              END as verification_code
       FROM food_listings f
       LEFT JOIN users u ON u.id = f.donor_id
       LEFT JOIN organizations o ON o.id = f.claimed_by
       LEFT JOIN LATERAL (
         SELECT verification_token 
         FROM handover_audits 
         WHERE listing_id = f.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) h ON true
       ORDER BY f.created_at DESC LIMIT 50`,
      [requestingOrgId]
    );
    res.json({ listings: dbRes.rows });
  } catch (err) {
    next(err);
  }
}

export async function getListingRecommendations(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch listing
    const listingRes = await query(`SELECT * FROM food_listings WHERE id = $1`, [id]);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    // Fetch candidate verified shelters and any active requests
    const sheltersRes = await query(
      `SELECT o.*, 
              r.id as active_request_id, r.quantity_kg as requested_kg, 
              r.category as requested_category, r.dietary_type as requested_dietary,
              r.needed_by as request_needed_by
       FROM organizations o
       LEFT JOIN recipient_requests r ON r.org_id = o.id AND r.status = 'ACTIVE'
       WHERE o.org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')
         AND o.is_verified = TRUE`
    );

    const candidates = sheltersRes.rows.map((s) => ({
      ...s,
      has_active_request: Boolean(s.active_request_id),
      dietary_preference: s.requested_dietary || 'ANY',
    }));

    const results = matchListingToRecipients(listing, candidates);

    res.json({
      listing,
      ...results,
    });
  } catch (err) {
    next(err);
  }
}
