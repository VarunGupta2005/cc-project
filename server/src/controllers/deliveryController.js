import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { verifyHandoverToken } from '../services/tokenService.js';

export async function verifyPickup(req, res, next) {
  try {
    const { listing_id, verification_code } = req.body;

    if (!listing_id || !verification_code) {
      return res.status(400).json({ error: 'Listing ID and Verification Code required' });
    }

    // Rate limiting: Maximum 5 failed attempts per listing within 5 minutes
    const attemptKey = `otp_attempts:${listing_id}`;
    let attempts = 0;
    try {
      const attemptsVal = await redisClient.get(attemptKey);
      attempts = attemptsVal ? parseInt(attemptsVal, 10) : 0;
    } catch (e) {
      // Non-blocking on Redis error
    }

    if (attempts >= 5) {
      return res.status(429).json({
        error: 'Too many failed verification attempts. Physical handover gate is temporarily locked for 5 minutes.',
        code: 'OTP_RATE_LIMITED',
      });
    }

    const auditRes = await query(
      `SELECT * FROM handover_audits WHERE listing_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [listing_id]
    );

    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'No claim record found for this listing' });
    }

    const audit = auditRes.rows[0];

    // Status transition validation
    const listingRes = await query(`SELECT status, donor_id FROM food_listings WHERE id = $1`, [listing_id]);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    if (listing.status !== 'CLAIMED') {
      return res.status(400).json({
        error: `Cannot verify pickup for listing in '${listing.status}' state. Only 'CLAIMED' listings can be picked up.`,
      });
    }

    // Ownership check if authenticated donor
    if (req.user && req.user.role === 'DONOR' && listing.donor_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to verify handover for another donor.' });
    }

    if (!verifyHandoverToken(audit.verification_token, verification_code)) {
      try {
        await redisClient.incr(attemptKey);
        await redisClient.expire(attemptKey, 300); // 5 min TTL
      } catch (e) {}
      return res.status(401).json({
        error: 'Invalid verification token. Pickup rejected.',
        attempts_remaining: Math.max(0, 4 - attempts),
      });
    }

    // Success: clear failed attempts
    try {
      await redisClient.del(attemptKey);
    } catch (e) {}

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

    const listingRes = await query(`SELECT status, claimed_by, quantity_kg FROM food_listings WHERE id = $1`, [listing_id]);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    // Idempotent delivery confirmation
    if (listing.status === 'DELIVERED') {
      const existingAudit = await query(`SELECT * FROM handover_audits WHERE listing_id = $1`, [listing_id]);
      return res.json({
        message: 'Delivery was already confirmed. Permanent audit is recorded.',
        audit: existingAudit.rows[0],
      });
    }

    if (listing.status !== 'IN_TRANSIT' && listing.status !== 'CLAIMED') {
      return res.status(400).json({
        error: `Cannot confirm delivery for listing in '${listing.status}' state. Batch must be 'IN_TRANSIT' or 'CLAIMED'.`,
      });
    }

    // Ownership check if authenticated shelter
    if (req.user && req.user.role === 'SHELTER' && req.user.org_id && listing.claimed_by !== req.user.org_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot confirm delivery for a donation claimed by another organization.' });
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

    // If recipient has active demand, mark fulfilled
    if (listing.claimed_by) {
      try {
        await query(
          `UPDATE recipient_requests 
           SET status = 'FULFILLED'
           WHERE id = (
             SELECT id FROM recipient_requests 
             WHERE org_id = $1 AND status = 'ACTIVE' 
             ORDER BY created_at ASC 
             LIMIT 1
           )`,
          [listing.claimed_by]
        );
      } catch (reqErr) {
        // Non-blocking
      }
    }

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
