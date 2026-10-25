import pg from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rescuegrid';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function seed() {
  console.log('[Seed] Connecting to PostgreSQL and Redis...');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const redis = createClient({ url: REDIS_URL });

  await redis.connect();

  try {
    // 1. Sync verified shelters to Redis geo:shelters
    const orgs = await pool.query(
      "SELECT id, name, longitude, latitude, capacity_kg FROM organizations WHERE org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')"
    );

    console.log(`[Seed] Found ${orgs.rows.length} shelters in database. Syncing to Redis geo:shelters...`);

    for (const org of orgs.rows) {
      await redis.geoAdd('geo:shelters', {
        longitude: parseFloat(org.longitude),
        latitude: parseFloat(org.latitude),
        member: org.id.toString(),
      });
      console.log(`  -> Synced: ${org.name} at (${org.latitude}, ${org.longitude})`);
    }

    console.log('[Seed] Sync complete! Redis geospatial index geo:shelters is ready.');
  } catch (err) {
    console.error('[Seed Error]', err);
  } finally {
    await pool.end();
    await redis.disconnect();
  }
}

seed();
