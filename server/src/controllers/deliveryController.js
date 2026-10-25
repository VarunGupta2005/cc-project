import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { verifyHandoverToken } from '../services/tokenService.js';

export async function verifyPickup(req, res, next) {
  try {
    const { listing_id, verification_code } = req.body;

    if (!listing_id || !verification_code) {
      return res.status(400).json({ error: 'Listing ID and Verification Code required' });
    }

    const auditRes = await query(
      `SELECT * FROM handover_audits WHERE listing_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [listing_id]
    );

    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'No claim record found for this listing' });
    }

    const audit = auditRes.rows[0];

    if (!verifyHandoverToken(audit.verification_token, verification_code)) {
      return res.status(401).json({ error: 'Invalid verification token. Pickup rejected.' });
    }

    // Mark pickup time and transition listing to IN_TRANSIT
    const now = new Date();
    await query(
      `UPDATE handover_audits SET pickup_time = $1 WHERE id = $2`,
      [now, audit.id]
    );

    await query(
      `UPDATE food_listings SET status = 'IN_TRANSIT' WHERE id = $1`,
      [listing_id]
    );

    await redisClient.publish('channel:alerts', JSON.stringify({
      event: 'DELIVERY_UPDATE',
      listingId: listing_id,
      status: 'IN_TRANSIT',
      pickup_time: now.toISOString(),
    }));

    res.json({
      message: 'Pickup verified successfully! Batch is now IN_TRANSIT.',
      pickup_time: now,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmDelivery(req, res, next) {
  try {
    const { listing_id, notes } = req.body;

    if (!listing_id) {
      return res.status(400).json({ error: 'Listing ID required' });
    }

    const now = new Date();

    const auditUpdate = await query(
      `UPDATE handover_audits 
       SET delivery_time = $1, proof_notes = $2
       WHERE listing_id = $3
       RETURNING *`,
      [now, notes || 'Verified handover at shelter', listing_id]
    );

    await query(
      `UPDATE food_listings SET status = 'DELIVERED' WHERE id = $1`,
      [listing_id]
    );

    // Broadcast delivery completion
    await redisClient.publish('channel:alerts', JSON.stringify({
      event: 'DELIVERY_UPDATE',
      listingId: listing_id,
      status: 'DELIVERED',
      delivery_time: now.toISOString(),
    }));

    res.json({
      message: 'Delivery confirmed and verified. Permanent audit committed to PostgreSQL!',
      audit: auditUpdate.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditHistory(req, res, next) {
  try {
    const audits = await query(
      `SELECT h.*, f.food_type, f.quantity_kg, o.name as shelter_name, u.full_name as donor_name
       FROM handover_audits h
       JOIN food_listings f ON f.id = h.listing_id
       LEFT JOIN organizations o ON o.id = h.ngo_id
       LEFT JOIN users u ON u.id = f.donor_id
       ORDER BY h.created_at DESC LIMIT 50`
    );
    res.json({ audits: audits.rows });
  } catch (err) {
    next(err);
  }
}
