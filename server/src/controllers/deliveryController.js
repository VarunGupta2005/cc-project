import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { removeDonationFromGeo } from '../services/redisEngine.js';
import { verifyHandoverToken, hashTokenDigest } from '../services/tokenService.js';

export async function verifyPickup(req, res, next) {
  try {
    const { listing_id, verification_code, allocation_id } = req.body;

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
    const listingRes = await query(`SELECT status, donor_id, quantity_remaining FROM food_listings WHERE id = $1`, [listing_id]);
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

    // Check delivery assignments for an assigned rider OTP (check ALL active assignments for listing or specific allocation)
    const assignRes = await query(
      `SELECT d.*, a.id as alloc_id, a.shelter_id, a.allocated_kg
       FROM delivery_assignments d
       JOIN allocations a ON a.id = d.allocation_id
       WHERE a.listing_id = $1 
         AND ($2::uuid IS NULL OR a.id = $2::uuid)
         AND d.status IN ('ASSIGNED', 'ACCEPTED')
       ORDER BY d.assigned_at DESC`,
      [listing_id, allocation_id || null]
    );

    let isMatch = false;
    let matchedAssignment = null;

    for (const assignment of assignRes.rows) {
      if (assignment.pickup_otp && verifyHandoverToken(assignment.pickup_otp, verification_code)) {
        isMatch = true;
        matchedAssignment = assignment;
        break;
      }
    }

    // Fallback to legacy handover_audits verification for backwards compatibility
    let matchedAudit = null;
    if (!isMatch) {
      const auditRes = await query(
        `SELECT * FROM handover_audits 
         WHERE listing_id = $1 
           AND ($2::uuid IS NULL OR allocation_id = $2::uuid)
           AND (proof_notes IS NULL OR proof_notes != 'CLAIM_CANCELLED')
           AND delivery_time IS NULL
         ORDER BY created_at DESC`,
        [listing_id, allocation_id || null]
      );
      for (const audit of auditRes.rows) {
        if (audit.verification_token && verifyHandoverToken(audit.verification_token, verification_code)) {
          isMatch = true;
          matchedAudit = audit;
          break;
        }
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
    const targetAllocId = matchedAssignment?.alloc_id || matchedAudit?.allocation_id || allocation_id;

    // Custody check: Ensure this parcel is not already picked up or completed
    if (targetAllocId) {
      const allocCheck = await query(`SELECT status FROM allocations WHERE id = $1`, [targetAllocId]);
      const currentAllocStatus = allocCheck.rows[0]?.status;
      if (currentAllocStatus === 'DELIVERED') {
        return res.status(400).json({ error: 'This parcel has already been delivered.' });
      }
      if (currentAllocStatus === 'IN_TRANSIT') {
        return res.status(400).json({ error: 'Pickup has already been verified. Parcel is in transit.' });
      }
    }

    // 1. If assigned to a rider, transition assignment to PICKED_UP
    if (matchedAssignment) {
      await query(
        `UPDATE delivery_assignments 
         SET status = 'PICKED_UP', picked_up_at = $1 
         WHERE id = $2`,
        [now, matchedAssignment.id]
      );
    }

    // 2. Mark the matched allocation as IN_TRANSIT
    if (targetAllocId) {
      await query(
        `UPDATE allocations 
         SET status = 'IN_TRANSIT', updated_at = $1 
         WHERE id = $2`,
        [now, targetAllocId]
      );
    }

    // 3. Update handover audit with digest and pickup time
    const digest = hashTokenDigest(verification_code);
    if (targetAllocId) {
      await query(
        `UPDATE handover_audits 
         SET pickup_time = $1, token_digest = COALESCE(token_digest, $2) 
         WHERE listing_id = $3 AND (allocation_id = $4 OR id = $5)`,
        [now, digest, listing_id, targetAllocId, matchedAudit?.id || null]
      );
    } else {
      await query(
        `UPDATE handover_audits 
         SET pickup_time = $1, token_digest = COALESCE(token_digest, $2) 
         WHERE listing_id = $3`,
        [now, digest, listing_id]
      );
    }

    // 4. Check if there are other allocations still awaiting pickup (RESERVED or ASSIGNED)
    const pendingAllocRes = await query(
      `SELECT COUNT(*) as pending_count 
       FROM allocations 
       WHERE listing_id = $1 AND status IN ('RESERVED', 'ASSIGNED')`,
      [listing_id]
    );
    const pendingCount = parseInt(pendingAllocRes.rows[0]?.pending_count || '0', 10);
    const remainingKg = parseFloat(listing.quantity_remaining || '0');

    // Only transition listing status to IN_TRANSIT if all claimed portions have been picked up
    if (pendingCount === 0 && remainingKg <= 0) {
      await query(
        `UPDATE food_listings SET status = 'IN_TRANSIT' WHERE id = $1`,
        [listing_id]
      );
      try {
        await redisClient.hSet(`listing:${listing_id}`, { status: 'IN_TRANSIT' });
      } catch (e) {}
    }

    await redisClient.publish('channel:alerts', JSON.stringify({
      event: 'DELIVERY_UPDATE',
      listingId: listing_id,
      allocationId: targetAllocId,
      status: pendingCount === 0 && remainingKg <= 0 ? 'IN_TRANSIT' : listing.status,
      pickup_time: now.toISOString(),
    }));

    res.json({
      message: 'Pickup verified successfully! Batch portion is now IN_TRANSIT.',
      pickup_time: now,
      allocation_id: targetAllocId,
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

    // Resolve listing and allocation
    let listingId = listing_id;
    let allocId = allocation_id;

    if (!listingId && allocId) {
      const aRes = await query(`SELECT listing_id FROM allocations WHERE id = $1`, [allocId]);
      if (aRes.rows.length > 0) listingId = aRes.rows[0].listing_id;
    }

    const listingRes = await query(
      `SELECT status, claimed_by, quantity_kg, quantity_remaining FROM food_listings WHERE id = $1`,
      [listingId]
    );

    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    // If caller is a shelter, find their allocation if not provided
    if (req.user && req.user.role === 'SHELTER' && req.user.org_id && !allocId) {
      const sAllocRes = await query(
        `SELECT id FROM allocations WHERE listing_id = $1 AND shelter_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [listingId, req.user.org_id]
      );
      if (sAllocRes.rows.length > 0) {
        allocId = sAllocRes.rows[0].id;
      }
    }

    const now = new Date();

    // 1. Mark specific allocation as DELIVERED
    if (allocId) {
      await query(
        `UPDATE allocations SET status = 'DELIVERED', updated_at = $1 WHERE id = $2`,
        [now, allocId]
      );

      await query(
        `UPDATE delivery_assignments 
         SET status = 'COMPLETED', completed_at = $1
         WHERE allocation_id = $2 AND status IN ('PICKED_UP', 'ACCEPTED', 'ASSIGNED')`,
        [now, allocId]
      );

      await query(
        `UPDATE handover_audits 
         SET delivery_time = $1, proof_notes = $2
         WHERE allocation_id = $3 OR (listing_id = $4 AND (ngo_id = $5 OR $5::uuid IS NULL))`,
        [now, notes || 'Verified handover and receipt at shelter', allocId, listingId, req.user?.org_id || null]
      );
    } else {
      await query(
        `UPDATE allocations SET status = 'DELIVERED', updated_at = $1 WHERE listing_id = $2`,
        [now, listingId]
      );

      await query(
        `UPDATE delivery_assignments 
         SET status = 'COMPLETED', completed_at = $1
         WHERE allocation_id IN (SELECT id FROM allocations WHERE listing_id = $2)
         AND status IN ('PICKED_UP', 'ACCEPTED', 'ASSIGNED')`,
        [now, listingId]
      );

      await query(
        `UPDATE handover_audits 
         SET delivery_time = $1, proof_notes = $2
         WHERE listing_id = $3`,
        [now, notes || 'Verified handover and receipt at shelter', listingId]
      );
    }

    // 2. Check remaining undelivered allocations (ignoring CANCELLED allocations)
    const remainingAllocsRes = await query(
      `SELECT COUNT(*) as undelivered_count 
       FROM allocations 
       WHERE listing_id = $1 AND status NOT IN ('DELIVERED', 'CANCELLED')`,
      [listingId]
    );
    const undeliveredCount = parseInt(remainingAllocsRes.rows[0]?.undelivered_count || '0', 10);

    // Fetch up-to-date total delivered weight vs total batch weight
    const batchSummaryRes = await query(
      `SELECT 
         f.quantity_kg, 
         f.quantity_remaining,
         COALESCE(SUM(a.allocated_kg) FILTER (WHERE a.status = 'DELIVERED'), 0)::numeric(10,2) as delivered_kg
       FROM food_listings f
       LEFT JOIN allocations a ON a.listing_id = f.id
       WHERE f.id = $1
       GROUP BY f.id`,
      [listingId]
    );

    const totalBatchKg = parseFloat(batchSummaryRes.rows[0]?.quantity_kg || listing.quantity_kg || '0');
    const deliveredBatchKg = parseFloat(batchSummaryRes.rows[0]?.delivered_kg || '0');
    const qtyRemaining = parseFloat(
      batchSummaryRes.rows[0]?.quantity_remaining !== undefined && batchSummaryRes.rows[0]?.quantity_remaining !== null
        ? batchSummaryRes.rows[0].quantity_remaining
        : listing.quantity_remaining || '0'
    );

    let finalListingStatus = 'IN_TRANSIT';

    if (undeliveredCount === 0) {
      if (qtyRemaining <= 0 || deliveredBatchKg >= totalBatchKg) {
        // Complete batch fulfilled and safely delivered
        finalListingStatus = 'DELIVERED';
        await query(
          `UPDATE food_listings SET status = 'DELIVERED', quantity_remaining = 0 WHERE id = $1`,
          [listingId]
        );
        try {
          await removeDonationFromGeo(listingId);
          await redisClient.hSet(`listing:${listingId}`, { status: 'DELIVERED', quantity_remaining: '0' });
        } catch (e) {
          console.error('[Redis Sync Error in confirmDeliveryReceipt]', e);
        }
      } else {
        // Portions were delivered, but remaining surplus is still on radar
        finalListingStatus = qtyRemaining >= totalBatchKg ? 'AVAILABLE' : 'PARTIALLY_CLAIMED';
        await query(
          `UPDATE food_listings SET status = $1 WHERE id = $2`,
          [finalListingStatus, listingId]
        );
        try {
          await redisClient.hSet(`listing:${listingId}`, { status: finalListingStatus });
        } catch (e) {
          console.error('[Redis Sync Error in confirmDeliveryReceipt]', e);
        }
      }
    } else {
      // There are other allocations still in transit or pending pickup
      const anyInTransitRes = await query(
        `SELECT COUNT(*) as intransit_count FROM allocations WHERE listing_id = $1 AND status = 'IN_TRANSIT'`,
        [listingId]
      );
      const inTransitCount = parseInt(anyInTransitRes.rows[0]?.intransit_count || '0', 10);
      finalListingStatus = inTransitCount > 0 ? 'IN_TRANSIT' : 'PARTIALLY_CLAIMED';
      await query(
        `UPDATE food_listings SET status = $1 WHERE id = $2`,
        [finalListingStatus, listingId]
      );
      try {
        await redisClient.hSet(`listing:${listingId}`, { status: finalListingStatus });
      } catch (e) {}
    }

    // If recipient has active demand, mark fulfilled
    const shelterOrgId = req.user?.org_id || listing.claimed_by;
    if (shelterOrgId) {
      try {
        await query(
          `UPDATE recipient_requests 
           SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP 
           WHERE org_id = $1 AND status = 'ACTIVE'`,
          [shelterOrgId]
        );
      } catch (reqErr) {}
    }

    await redisClient.publish('channel:alerts', JSON.stringify({
      event: 'DELIVERY_UPDATE',
      listingId,
      allocationId: allocId,
      status: finalListingStatus,
      delivery_time: now.toISOString(),
    }));

    res.json({
      message: 'Delivery confirmed successfully! Handover audit updated.',
      delivery_time: now,
      allocation_id: allocId,
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
