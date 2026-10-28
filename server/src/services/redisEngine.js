import { redisClient } from '../config/redis.js';

// =============================================================
// ATOMIC CLAIM LUA SCRIPT
// Linearizable mutual exclusion, cascading priority tier enforcement,
// and atomic partial quantity decrement in a single engine tick
// =============================================================
const CLAIM_LUA_SCRIPT = `
  local listing_key = KEYS[1]
  local current_status = redis.call('HGET', listing_key, 'status')

  -- 1. Listing must exist and be either AVAILABLE or PARTIALLY_CLAIMED
  if not current_status or (current_status ~= 'AVAILABLE' and current_status ~= 'PARTIALLY_CLAIMED') then
      return { 0, 'ERR_ALREADY_CLAIMED', '0', '0' }
  end

  -- 2. Check Tiered Priority Windows
  local p1 = redis.call('HGET', listing_key, 'priority_tier_1_recipient')
  local p2 = redis.call('HGET', listing_key, 'priority_tier_2_recipients')
  local created_epoch_str = redis.call('HGET', listing_key, 'created_at_epoch')
  local now_epoch = tonumber(ARGV[4])

  if p1 and p1 ~= '' and p1 ~= 'NONE' and created_epoch_str and now_epoch then
      local created_epoch = tonumber(created_epoch_str)
      if created_epoch and created_epoch > 0 then
          local elapsed = now_epoch - created_epoch
          local tier1_limit = tonumber(redis.call('HGET', listing_key, 'tier_1_window_seconds')) or 300
          local tier2_limit = tonumber(redis.call('HGET', listing_key, 'tier_2_window_seconds')) or 900

          if elapsed < tier1_limit then
              -- Tier 1 Window (Dynamic based on remaining feasible time): Exclusive reservation for Rank #1 recipient
              if ARGV[1] ~= p1 then
                  local remaining_lock = tier1_limit - elapsed
                  return { 0, 'ERR_PRIORITY_RESERVED', 'TIER_1', tostring(remaining_lock) }
              end
          elseif elapsed < tier2_limit then
              -- Tier 2 Window (Dynamic based on remaining feasible time): Expanded reservation for Rank #1 and Top-5 recipients
              if ARGV[1] ~= p1 then
                  local is_tier_2 = false
                  if p2 and p2 ~= '' then
                      for id in string.gmatch(p2, '([^,]+)') do
                          if id == ARGV[1] then
                              is_tier_2 = true
                              break
                          end
                      end
                  end
                  if not is_tier_2 then
                      local remaining_lock = tier2_limit - elapsed
                      return { 0, 'ERR_PRIORITY_RESERVED', 'TIER_2', tostring(remaining_lock) }
                  end
              end
          end
          -- Tier 3 Window: Fully unlocked for all verified recipients in radius
      end
  end

  -- 3. Quantity check & Atomic Decrement
  local qty_rem_str = redis.call('HGET', listing_key, 'quantity_remaining')
  if not qty_rem_str or qty_rem_str == '' then
      qty_rem_str = redis.call('HGET', listing_key, 'quantity_kg')
  end
  local qty_rem = tonumber(qty_rem_str) or 0

  if qty_rem <= 0 then
      return { 0, 'ERR_EXHAUSTED', '0', '0' }
  end

  local claim_arg = ARGV[3]
  local claim_kg = tonumber(claim_arg)

  if not claim_kg or claim_kg <= 0 or claim_kg >= qty_rem or claim_arg == 'ALL' then
      -- FULL CLAIM: Entire remaining surplus is claimed
      local claimed_amount = qty_rem
      redis.call('HSET', listing_key, 'status', 'CLAIMED', 'quantity_remaining', '0', 'claimed_by', ARGV[1])
      redis.call('ZREM', 'geo:donations', ARGV[2])
      -- Extend retention to 24 hours so active delivery state is preserved in Redis
      redis.call('EXPIRE', listing_key, 86400)
      return { 1, 'FULL', tostring(claimed_amount), '0' }
  else
      -- PARTIAL CLAIM: Decrement remaining quantity in-place; retain in geo:donations for subsequent claims
      local new_rem = qty_rem - claim_kg
      redis.call('HSET', listing_key, 'status', 'PARTIALLY_CLAIMED', 'quantity_remaining', tostring(new_rem))
      return { 1, 'PARTIAL', tostring(claim_kg), tostring(new_rem) }
  end
`;

/**
 * Seed a shelter's coordinates into the geo:shelters index.
 */
export async function seedShelter(shelterId, lng, lat) {
  return await redisClient.geoAdd('geo:shelters', {
    longitude: parseFloat(lng),
    latitude: parseFloat(lat),
    member: shelterId.toString(),
  });
}

/**
 * Add active food donation to geo:donations and initialize its TTL Hash.
 */
export async function addDonationToGeo(listingId, lng, lat, ttlSeconds, metadata = {}) {
  const multi = redisClient.multi();

  // 1. Add to geospatial index
  multi.geoAdd('geo:donations', {
    longitude: parseFloat(lng),
    latitude: parseFloat(lat),
    member: listingId.toString(),
  });

  // 2. Create in-memory Hash state
  const hashKey = `listing:${listingId}`;
  const totalQty = metadata.quantity_kg ? metadata.quantity_kg.toString() : '10';
  const remQty = metadata.quantity_remaining !== undefined && metadata.quantity_remaining !== null
    ? metadata.quantity_remaining.toString()
    : totalQty;

  const hashData = {
    id: listingId.toString(),
    status: 'AVAILABLE',
    food_type: metadata.food_type || 'Cooked Meals',
    quantity_kg: totalQty,
    quantity_remaining: remQty,
    donor_id: metadata.donor_id ? metadata.donor_id.toString() : '',
    pickup_address: metadata.pickup_address || '',
    pickup_lat: lat.toString(),
    pickup_lng: lng.toString(),
    category: metadata.category || 'COOKED_MEAL',
    dietary_type: metadata.dietary_type || 'VEG',
    pickup_deadline: metadata.pickup_deadline ? new Date(metadata.pickup_deadline).toISOString() : '',
    consumption_deadline: metadata.consumption_deadline ? new Date(metadata.consumption_deadline).toISOString() : '',
    safety_declared: metadata.safety_declared !== false ? 'true' : 'false',
    created_at: new Date().toISOString(),
    created_at_epoch: Math.floor(Date.now() / 1000).toString(),
    priority_tier_1_recipient: metadata.priority_tier_1_recipient || '',
    priority_tier_2_recipients: metadata.priority_tier_2_recipients || '',
    tier_1_window_seconds: (metadata.tier_1_window_seconds || 300).toString(),
    tier_2_window_seconds: (metadata.tier_2_window_seconds || 900).toString(),
  };

  multi.hSet(hashKey, hashData);

  // 3. Set exact TTL on the Hash key (triggers Keyspace notification on expiry)
  if (ttlSeconds && ttlSeconds > 0) {
    multi.expire(hashKey, ttlSeconds);
  }

  return await multi.exec();
}

/**
 * Re-open a cancelled donation in the geospatial index and restore remaining biological TTL.
 */
export async function reopenDonationInGeo(listingId, lng, lat, remainingTtlSeconds, remainingKg, status = 'AVAILABLE') {
  const multi = redisClient.multi();
  const hashKey = `listing:${listingId}`;

  // 1. Re-add to geospatial index
  multi.geoAdd('geo:donations', {
    longitude: parseFloat(lng),
    latitude: parseFloat(lat),
    member: listingId.toString(),
  });

  // 2. Update hash status and remaining quantity
  multi.hSet(hashKey, {
    status: status,
    quantity_remaining: remainingKg.toString(),
    claimed_by: '',
  });

  // 3. Set exact remaining TTL
  if (remainingTtlSeconds && remainingTtlSeconds > 0) {
    multi.expire(hashKey, remainingTtlSeconds);
  }

  return await multi.exec();
}

/**
 * Query shelters near a donor's location (Used at donor intake).
 */
export async function findNearbyShelters(donorLng, donorLat, radiusKm = 10) {
  try {
    return await redisClient.geoSearchWith(
      'geo:shelters',
      { longitude: parseFloat(donorLng), latitude: parseFloat(donorLat) },
      { radius: parseFloat(radiusKm), unit: 'km' },
      ['WITHDIST', 'WITHCOORD']
    );
  } catch (err) {
    console.error('[Redis GeoSearch Shelters Error]', err);
    return [];
  }
}

/**
 * Query available food donations near a shelter (Used by shelter dashboards).
 */
export async function findNearbyDonations(shelterLng, shelterLat, radiusKm = 10) {
  try {
    return await redisClient.geoSearchWith(
      'geo:donations',
      { longitude: parseFloat(shelterLng), latitude: parseFloat(shelterLat) },
      { radius: parseFloat(radiusKm), unit: 'km' },
      ['WITHDIST', 'WITHCOORD']
    );
  } catch (err) {
    console.error('[Redis GeoSearch Donations Error]', err);
    return [];
  }
}

/**
 * Removes a listing from the active geospatial index.
 */
export async function removeDonationFromGeo(listingId) {
  return await redisClient.zRem('geo:donations', listingId.toString());
}

/**
 * Executes the atomic claim Lua script.
 * Supports cascading priority tier enforcement and partial quantity claiming.
 */
export async function attemptAtomicClaim(listingId, shelterId, claimKg = null, currentTimestampSec = null) {
  const listingKey = `listing:${listingId}`;
  const nowSec = currentTimestampSec || Math.floor(Date.now() / 1000);
  const claimQtyArg = (claimKg !== null && claimKg !== undefined && !isNaN(claimKg)) ? claimKg.toString() : 'ALL';

  const result = await redisClient.eval(CLAIM_LUA_SCRIPT, {
    keys: [listingKey],
    arguments: [shelterId.toString(), listingId.toString(), claimQtyArg, nowSec.toString()],
  });

  if (Array.isArray(result)) {
    const success = result[0] === 1;
    if (success) {
      return {
        success: true,
        type: result[1], // 'FULL' or 'PARTIAL'
        claimedKg: parseFloat(result[2] || 0),
        remainingKg: parseFloat(result[3] || 0),
      };
    } else {
      return {
        success: false,
        reason: result[1], // 'ERR_PRIORITY_RESERVED', 'ERR_ALREADY_CLAIMED', 'ERR_EXHAUSTED'
        tier: result[2] || null, // 'TIER_1' or 'TIER_2'
        retryAfterSeconds: parseInt(result[3] || 0, 10),
      };
    }
  }

  return {
    success: result === 1,
    type: result === 1 ? 'FULL' : 'CONFLICT',
    claimedKg: 0,
    remainingKg: 0,
  };
}

/**
 * Reads in-memory listing metadata.
 */
export async function getListingState(listingId) {
  return await redisClient.hGetAll(`listing:${listingId}`);
}
