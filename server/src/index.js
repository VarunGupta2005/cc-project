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

    // 6. Start HTTP & WebSocket Server
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
