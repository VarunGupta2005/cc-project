import { query } from '../config/database.js';
import { seedShelter } from '../services/redisEngine.js';

/**
 * Platform Admin: Overall cluster metrics and real-time operational status
 */
export async function getAdminOverview(req, res, next) {
  try {
    const [orgsCount, usersCount, listingsCount, auditsCount, allocsCount] = await Promise.all([
      query(`SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN verification_status = 'PENDING' OR is_verified IS FALSE THEN 1 END) as pending,
              COUNT(CASE WHEN verification_status = 'VERIFIED' OR is_verified IS TRUE THEN 1 END) as verified
             FROM organizations`),
      query(`SELECT COUNT(*) as total, role FROM users GROUP BY role`),
      query(`SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN status IN ('AVAILABLE', 'PARTIALLY_CLAIMED') THEN 1 END) as active,
              SUM(CASE WHEN status IN ('AVAILABLE', 'PARTIALLY_CLAIMED') THEN quantity_remaining ELSE 0 END) as active_surplus_kg
             FROM food_listings`),
      query(`SELECT 
              COUNT(*) as total,
              SUM(COALESCE(quantity_claimed_kg, 0)) as total_kg_redistributed
             FROM handover_audits
             WHERE delivery_time IS NOT NULL`),
      query(`SELECT COUNT(*) as active_allocations FROM allocations WHERE status IN ('RESERVED', 'ASSIGNED', 'IN_TRANSIT')`),
    ]);

    res.json({
      organizations: orgsCount.rows[0],
      users_by_role: usersCount.rows,
      listings: listingsCount.rows[0],
      compliance_audits: auditsCount.rows[0],
      allocations: allocsCount.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin: List organizations with verification status filter
 */
export async function getOrganizations(req, res, next) {
  try {
    const { status } = req.query; // 'PENDING', 'VERIFIED', 'REJECTED'
    let sql = `
      SELECT o.*, u.email as contact_email, u.full_name as contact_person, u.phone as contact_phone
      FROM organizations o
      LEFT JOIN users u ON u.id = o.user_id
    `;
    const params = [];

    if (status) {
      sql += ` WHERE o.verification_status = $1`;
      params.push(status.toUpperCase());
    }

    sql += ` ORDER BY o.created_at DESC`;

    const result = await query(sql, params);
    res.json({ organizations: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin: Approve or reject organization verification
 */
export async function verifyOrganization(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // 'VERIFIED' or 'REJECTED'

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'VERIFIED' or 'REJECTED'" });
    }

    const isVerifiedBool = status === 'VERIFIED';
    const updatedRes = await query(
      `UPDATE organizations
       SET verification_status = $1,
           is_verified = $2,
           verified_at = CURRENT_TIMESTAMP,
           verified_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, isVerifiedBool, req.user?.id, id]
    );

    if (updatedRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const org = updatedRes.rows[0];

    // If verified shelter, seed coordinates into Redis spatial index immediately
    if (isVerifiedBool && ['SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN'].includes(org.org_type)) {
      await seedShelter(org.id, org.longitude, org.latitude);
      console.log(`[Admin] Seeded approved shelter ${org.name} into Redis geo:shelters`);
    }

    res.json({
      message: `Organization ${org.name} marked as ${status}`,
      organization: org,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin: Global dispatch map markers (restricted to platform admin)
 */
export async function getDispatchMapData(req, res, next) {
  try {
    const [listingsRes, sheltersRes, auditsRes] = await Promise.all([
      query(
        `SELECT f.id, f.food_type, f.quantity_kg, f.quantity_remaining, f.status, f.pickup_lat, f.pickup_lng,
                f.pickup_address, f.category, f.dietary_type, f.expires_at, f.created_at,
                u.full_name as donor_name
         FROM food_listings f
         LEFT JOIN users u ON u.id = f.donor_id
         WHERE f.status IN ('AVAILABLE', 'PARTIALLY_CLAIMED', 'CLAIMED', 'IN_TRANSIT')`
      ),
      query(
        `SELECT id, name, org_type, latitude, longitude, capacity_kg, available_capacity_kg, verification_status, is_verified
         FROM organizations
         WHERE org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')`
      ),
      query(
        `SELECT h.id, h.listing_id, h.pickup_time, h.delivery_time, h.quantity_claimed_kg,
                f.food_type, o.name as shelter_name, u.full_name as donor_name,
                -- REDACT raw verification_token secret: output non-secret digest reference
                COALESCE(h.token_digest, SUBSTRING(MD5(COALESCE(h.verification_token, 'verified')), 1, 16)) as token_fingerprint
         FROM handover_audits h
         JOIN food_listings f ON f.id = h.listing_id
         LEFT JOIN organizations o ON o.id = h.ngo_id
         LEFT JOIN users u ON u.id = f.donor_id
         ORDER BY h.created_at DESC LIMIT 50`
      ),
    ]);

    res.json({
      active_listings: listingsRes.rows,
      shelters: sheltersRes.rows,
      recent_audits: auditsRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin: Immutable audit history with cryptographic digest (zero secret leakage)
 */
export async function getComplianceAudits(req, res, next) {
  try {
    const audits = await query(
      `SELECT h.id, h.listing_id, h.pickup_time, h.delivery_time, h.quantity_claimed_kg, h.proof_notes, h.created_at,
              f.food_type, f.quantity_kg as batch_total_kg, f.category,
              o.name as shelter_name, o.id as shelter_id,
              u.full_name as donor_name,
              c.full_name as courier_name,
              -- REDACT raw secret code: return proof fingerprint
              COALESCE(h.token_digest, SUBSTRING(MD5(COALESCE(h.verification_token, 'verified')), 1, 16)) as verification_digest
       FROM handover_audits h
       JOIN food_listings f ON f.id = h.listing_id
       LEFT JOIN organizations o ON o.id = h.ngo_id
       LEFT JOIN users u ON u.id = f.donor_id
       LEFT JOIN users c ON c.id = h.courier_id
       ORDER BY h.created_at DESC LIMIT 100`
    );

    res.json({ audits: audits.rows });
  } catch (err) {
    next(err);
  }
}
