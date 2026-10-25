import { redisClient } from '../config/redis.js';

// =============================================================
// ATOMIC CLAIM LUA SCRIPT
// Guarantees linearizable mutual exclusion in a single engine tick
// =============================================================
const CLAIM_LUA_SCRIPT = `
  local listing_key = KEYS[1]
  local current_status = redis.call('HGET', listing_key, 'status')

  if current_status == 'AVAILABLE' then
      redis.call('HSET', listing_key, 'status', 'CLAIMED', 'claimed_by', ARGV[1])
      redis.call('ZREM', 'geo:donations', ARGV[2])
      return 1
  else
      return 0
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
  const hashData = {
    id: listingId.toString(),
    status: 'AVAILABLE',
    food_type: metadata.food_type || 'Cooked Meals',
    quantity_kg: metadata.quantity_kg ? metadata.quantity_kg.toString() : '10',
    donor_id: metadata.donor_id ? metadata.donor_id.toString() : '',
    pickup_address: metadata.pickup_address || '',
    pickup_lat: lat.toString(),
    pickup_lng: lng.toString(),
    created_at: new Date().toISOString(),
  };

  multi.hSet(hashKey, hashData);

  // 3. Set exact TTL on the Hash key (triggers Keyspace notification on expiry)
  if (ttlSeconds && ttlSeconds > 0) {
    multi.expire(hashKey, ttlSeconds);
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
 * Returns true if claim succeeded (winner), false if conflict (loser).
 */
export async function attemptAtomicClaim(listingId, shelterId) {
  const listingKey = `listing:${listingId}`;
  
  const result = await redisClient.eval(CLAIM_LUA_SCRIPT, {
    keys: [listingKey],
    arguments: [shelterId.toString(), listingId.toString()],
  });

  return result === 1;
}

/**
 * Reads in-memory listing metadata.
 */
export async function getListingState(listingId) {
  return await redisClient.hGetAll(`listing:${listingId}`);
}
