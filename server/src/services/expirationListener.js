import { redisSubClient, redisClient } from '../config/redis.js';
import { removeDonationFromGeo } from './redisEngine.js';
import { query } from '../config/database.js';

export async function reconcileExpiredListings(io) {
  try {
    const expiredRes = await query(
      `UPDATE food_listings
       SET status = 'EXPIRED'
       WHERE status = 'AVAILABLE' AND expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    );

    for (const row of expiredRes.rows) {
      await removeDonationFromGeo(row.id);
      if (io) {
        io.emit('food:expired', { listingId: row.id });
      }
    }

    if (expiredRes.rowCount > 0) {
      console.log(`[Reconciliation Daemon] Reconciled ${expiredRes.rowCount} expired listings from PostgreSQL.`);
    }
  } catch (err) {
    console.error('[Reconciliation Daemon Error]', err);
  }
}

export async function startExpirationListener(io) {
  try {
    // 1. Initial reconciliation on startup
    await reconcileExpiredListings(io);

    // 2. Periodic reconciliation interval (every 60 seconds)
    setInterval(() => reconcileExpiredListings(io), 60000);

    // 3. Redis Keyspace event for expired keys in database 0
    const keyspaceChannel = '__keyevent@0__:expired';

    await redisSubClient.subscribe(keyspaceChannel, async (expiredKey) => {
      // We only care about listing:{id} keys
      if (expiredKey.startsWith('listing:')) {
        const listingId = expiredKey.replace('listing:', '');
        console.log(`[TTL Expiration Hook] Listing ${listingId} reached TTL 0. Evaporating state...`);

        try {
          // 1. Remove coordinate pin from geospatial sorted set
          await removeDonationFromGeo(listingId);

          // 2. Transition status in PostgreSQL
          const updateRes = await query(
            `UPDATE food_listings 
             SET status = 'EXPIRED' 
             WHERE id = $1 AND status = 'AVAILABLE'
             RETURNING id, food_type, donor_id`,
            [listingId]
          );

          if (updateRes.rowCount > 0) {
            console.log(`[DB Auto-Expire] Marked listing ${listingId} as EXPIRED in PostgreSQL.`);
          }

          // 3. Broadcast real-time expiration alert via Redis Pub/Sub
          const alertPayload = JSON.stringify({
            event: 'FOOD_EXPIRED',
            listingId,
            timestamp: new Date().toISOString(),
          });

          await redisClient.publish('channel:alerts', alertPayload);

          // 4. If Socket.io instance is provided, push directly to clients
          if (io) {
            io.emit('food:expired', { listingId });
          }
        } catch (innerErr) {
          console.error(`[Error Handling Expiration for ${listingId}]`, innerErr);
        }
      }
    });

    console.log(`[Keyspace Daemon] Subscribed to ${keyspaceChannel}. Active TTL listener running.`);
  } catch (err) {
    console.error('[Failed to Start Expiration Listener]', err);
  }
}
