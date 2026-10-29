import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initRedis } from './config/redis.js';
import { pool } from './config/database.js';
import { initSocketManager } from './socket/socketManager.js';
import { startExpirationListener } from './services/expirationListener.js';
import { seedShelter } from './services/redisEngine.js';

import authRoutes from './routes/authRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import shelterRoutes from './routes/shelterRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import riderRoutes from './routes/riderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Global Middlewares
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    instance: process.env.HOSTNAME || 'api-replica',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log('--- Starting RescueGrid Cloud Node ---');

    // 1. Initialize Redis Dual-Client connection
    await initRedis();

    // 2. Test PostgreSQL connection
    const dbTest = await pool.query('SELECT NOW() as now');
    console.log(`[PostgreSQL] Connected successfully. DB Time: ${dbTest.rows[0].now}`);

    // 3. Attach Socket.io WebSocket Gateway
    const io = initSocketManager(server);

    // 4. Start Redis Keyspace Expiration Listener Daemon
    await startExpirationListener(io);

    // 5. Seed verified shelters from PostgreSQL into Redis geo:shelters
    try {
      const orgs = await pool.query(
        "SELECT id, longitude, latitude, name FROM organizations WHERE org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')"
      );
      for (const org of orgs.rows) {
        await seedShelter(org.id, org.longitude, org.latitude);
      }
      console.log(`[Bootstrap] Seeded ${orgs.rows.length} verified shelters into Redis geo:shelters.`);
    } catch (seedErr) {
      console.warn('[Bootstrap Warning] Could not pre-seed shelters:', seedErr.message);
    }

    // 6. Reconcile any delivered listings stuck in IN_TRANSIT
    try {
      const reconcileRes = await pool.query(`
        UPDATE food_listings f
        SET status = 'DELIVERED', quantity_remaining = 0
        WHERE f.status = 'IN_TRANSIT'
          AND NOT EXISTS (
            SELECT 1 FROM allocations a 
            WHERE a.listing_id = f.id AND a.status NOT IN ('DELIVERED', 'CANCELLED')
          )
          AND (
            f.quantity_remaining IS NULL 
            OR f.quantity_remaining <= 0 
            OR (
              SELECT COALESCE(SUM(a.allocated_kg), 0) 
              FROM allocations a 
              WHERE a.listing_id = f.id AND a.status = 'DELIVERED'
            ) >= f.quantity_kg
          )
        RETURNING id
      `);
      if (reconcileRes.rows.length > 0) {
        console.log(`[Bootstrap] Reconciled ${reconcileRes.rows.length} stuck listings to DELIVERED status.`);
      }
    } catch (recErr) {
      console.warn('[Bootstrap Warning] Listing reconciliation check:', recErr.message);
    }

    // 7. Start HTTP & WebSocket Server
    server.listen(PORT, () => {
      console.log(`[RescueGrid API] Server running on port ${PORT}`);
      console.log(`[RescueGrid API] Instance: ${process.env.HOSTNAME || 'localhost'}`);
    });
  } catch (err) {
    console.error('[Bootstrap Critical Failure]', err);
    process.exit(1);
  }
}

bootstrap();
