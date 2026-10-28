import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { verifyHandoverToken, hashTokenDigest } from '../services/tokenService.js';

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

    // Status transition validation
    const listingRes = await query(`SELECT status, donor_id FROM food_listings WHERE id = $1`, [listing_id]);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    if (listing.status !== 'CLAIMED' && listing.status !== 'PARTIALLY_CLAIMED') {
      return res.status(400).json({
        error: `Cannot verify pickup for listing in '${listing.status}' state. Only claimed listings can be picked up.`,
      });
    }

    // Ownership check if authenticated donor
    if (req.user && req.user.role === 'DONOR' && listing.donor_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to verify handover for another donor.' });
    }

    // Check delivery assignments for an assigned rider OTP
    const assignRes = await query(
      `SELECT d.*, a.id as alloc_id, a.shelter_id
       FROM delivery_assignments d
       JOIN allocations a ON a.id = d.allocation_id
       WHERE a.listing_id = $1 AND d.status IN ('ASSIGNED', 'ACCEPTED')
       ORDER BY d.assigned_at DESC LIMIT 1`,
      [listing_id]
    );

    let isMatch = false;
    let matchedAssignment = null;

    if (assignRes.rows.length > 0 && assignRes.rows[0].pickup_otp) {
      matchedAssignment = assignRes.rows[0];
      isMatch = verifyHandoverToken(matchedAssignment.pickup_otp, verification_code);
    }

    // Fallback to legacy handover_audits verification for backwards compatibility
    if (!isMatch) {
      const auditRes = await query(
        `SELECT * FROM handover_audits WHERE listing_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [listing_id]
      );
      if (auditRes.rows.length > 0 && auditRes.rows[0].verification_token) {
        isMatch = verifyHandoverToken(auditRes.rows[0].verification_token, verification_code);
      }
    }

    if (!isMatch) {
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

    const now = new Date();

    // 1. If assigned to a rider, transition assignment to PICKED_UP
    if (matchedAssignment) {
      await query(
        `UPDATE delivery_assignments 
         SET status = 'PICKED_UP', picked_up_at = $1 
         WHERE id = $2`,
        [now, matchedAssignment.id]
      );

      await query(
        `UPDATE allocations 
         SET status = 'IN_TRANSIT', updated_at = $1 
         WHERE id = $2`,
        [now, matchedAssignment.alloc_id]
      );
    }

    // 2. Mark listing as IN_TRANSIT
    await query(
      `UPDATE food_listings SET status = 'IN_TRANSIT' WHERE id = $1`,
      [listing_id]
    );

    // 3. Update handover audit with digest and pickup time
    const digest = hashTokenDigest(verification_code);
    await query(
      `UPDATE handover_audits 
       SET pickup_time = $1, token_digest = COALESCE(token_digest, $2) 
       WHERE listing_id = $3`,
      [now, digest, listing_id]
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
    const { listing_id, allocation_id, notes } = req.body;
    const targetId = listing_id || allocation_id;

    if (!targetId) {
      return res.status(400).json({ error: 'Listing ID or Allocation ID required' });
    }

    // Anti-Fraud Rule: Rider CANNOT independently certify their own delivery!
    if (req.user && (req.user.role === 'RIDER' || req.user.role === 'COURIER')) {
      return res.status(403).json({
        error: 'Forbidden: Riders cannot independently certify delivery. Authorized receiving shelter personnel must confirm receipt.',
      });
    }

    const listingRes = await query(
      `SELECT status, claimed_by, quantity_kg FROM food_listings WHERE id = $1`,
      [listing_id]
    );

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

    if (listing.status !== 'IN_TRANSIT' && listing.status !== 'CLAIMED' && listing.status !== 'PARTIALLY_CLAIMED') {
      return res.status(400).json({
        error: `Cannot confirm delivery for listing in '${listing.status}' state. Batch must be 'IN_TRANSIT' or 'CLAIMED'.`,
      });
    }

    // Ownership check if authenticated shelter
    if (req.user && req.user.role === 'SHELTER' && req.user.org_id && listing.claimed_by !== req.user.org_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot confirm delivery for a donation claimed by another organization.' });
    }

    const now = new Date();

    // 1. Mark listing as DELIVERED
    await query(
      `UPDATE food_listings SET status = 'DELIVERED' WHERE id = $1`,
      [listing_id]
    );

    // 2. Mark allocations as DELIVERED
    await query(
      `UPDATE allocations SET status = 'DELIVERED', updated_at = $1 WHERE listing_id = $2`,
      [now, listing_id]
    );

    // 3. Mark active delivery assignments as COMPLETED
    await query(
      `UPDATE delivery_assignments 
       SET status = 'COMPLETED', completed_at = $1
       WHERE allocation_id IN (SELECT id FROM allocations WHERE listing_id = $2)
       AND status IN ('PICKED_UP', 'ACCEPTED', 'ASSIGNED')`,
      [now, listing_id]
    );

    const auditUpdate = await query(
      `UPDATE handover_audits 
       SET delivery_time = $1, proof_notes = $2
       WHERE listing_id = $3
       RETURNING *`,
      [now, notes || 'Verified handover and receipt at shelter', listing_id]
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
      `SELECT h.id, h.listing_id, h.pickup_time, h.delivery_time, h.quantity_claimed_kg, h.proof_notes, h.created_at,
              f.food_type, f.quantity_kg, o.name as shelter_name, u.full_name as donor_name,
              -- REDACT raw secret code: output cryptographic fingerprint
              COALESCE(h.token_digest, SUBSTRING(MD5(COALESCE(h.verification_token, 'verified')), 1, 16)) as verification_token
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
