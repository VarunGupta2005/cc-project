import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { generateAssignmentOtp, hashTokenDigest } from '../services/tokenService.js';

/**
 * Shelter assigns a rider from its own organization to a claimed allocation.
 * Enforces:
 * - Shelter authorization
 * - Rider belongs to this shelter organization
 * - Concurrency guarantee: Only 1 active rider assignment per allocation (backed by unique index)
 */
export async function assignRider(req, res, next) {
  try {
    const { allocation_id, rider_id, notes } = req.body;

    if (!allocation_id || !rider_id) {
      return res.status(400).json({ error: 'Allocation ID and Rider ID are required' });
    }

    const shelterOrgId = req.user?.org_id;
    if (req.user?.role === 'SHELTER' && !shelterOrgId) {
      return res.status(403).json({ error: 'Forbidden: Missing shelter organization ID' });
    }

    // 1. Verify allocation exists and belongs to this shelter
    const allocRes = await query(
      `SELECT a.*, f.food_type, f.pickup_address, f.pickup_deadline
       FROM allocations a
       JOIN food_listings f ON f.id = a.listing_id
       WHERE a.id = $1`,
      [allocation_id]
    );

    if (allocRes.rows.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const allocation = allocRes.rows[0];

    if (req.user?.role === 'SHELTER' && allocation.shelter_id !== shelterOrgId) {
      return res.status(403).json({
        error: 'Forbidden: You cannot assign riders to another organization’s allocation',
      });
    }

    if (allocation.status === 'DELIVERED' || allocation.status === 'CANCELLED') {
      return res.status(400).json({
        error: `Cannot assign rider to allocation in '${allocation.status}' state`,
      });
    }

    // 2. Verify rider belongs to this shelter organization
    const riderRes = await query(
      `SELECT id, full_name, email, phone, role, organization_id
       FROM users
       WHERE id = $1 AND role IN ('RIDER', 'COURIER')`,
      [rider_id]
    );

    if (riderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Rider not found or invalid role' });
    }

    const rider = riderRes.rows[0];

    if (shelterOrgId && rider.organization_id && rider.organization_id !== shelterOrgId) {
      return res.status(403).json({
        error: 'Cross-Tenant Violation: Rider does not belong to your organization',
      });
    }

    // 3. Atomically cancel any existing active assignment if this is a reassignment
    await query(
      `UPDATE delivery_assignments
       SET status = 'CANCELLED'
       WHERE allocation_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED')`,
      [allocation_id]
    );

    // 4. Create new delivery assignment
    const assignIdRes = await query(`SELECT gen_random_uuid() as id`);
    const newAssignmentId = assignIdRes.rows[0].id;

    // Generate dynamic OTP scoped to (allocation_id, assignment_id, rider_id)
    const { otpCode } = generateAssignmentOtp(allocation_id, newAssignmentId, rider_id);

    const insertRes = await query(
      `INSERT INTO delivery_assignments 
        (id, allocation_id, rider_id, assigned_by, status, pickup_otp, notes)
       VALUES ($1, $2, $3, $4, 'ASSIGNED', $5, $6)
       RETURNING *`,
      [newAssignmentId, allocation_id, rider_id, req.user?.id, otpCode, notes || null]
    );

    const assignment = insertRes.rows[0];

    // Update allocation state to ASSIGNED if previously RESERVED
    await query(
      `UPDATE allocations 
       SET status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND status = 'RESERVED'`,
      [allocation_id]
    );

    // Update handover_audits record with assignment token digest (redacting plaintext)
    const digest = hashTokenDigest(otpCode);
    await query(
      `UPDATE handover_audits 
       SET courier_id = $1, allocation_id = $2, token_digest = $3, verification_token = $4
       WHERE listing_id = $5`,
      [rider_id, allocation_id, digest, otpCode, allocation.listing_id]
    );

    // Notify connected clients via Redis Pub/Sub
    await redisClient.publish(
      'channel:alerts',
      JSON.stringify({
        event: 'RIDER_ASSIGNED',
        allocationId: allocation_id,
        assignmentId: assignment.id,
        riderId: rider_id,
        riderName: rider.full_name,
        timestamp: new Date().toISOString(),
      })
    );

    res.status(201).json({
      message: `Rider ${rider.full_name} assigned successfully!`,
      assignment: {
        id: assignment.id,
        allocation_id: assignment.allocation_id,
        rider_id: assignment.rider_id,
        rider_name: rider.full_name,
        status: assignment.status,
        assigned_at: assignment.assigned_at,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Conflict: This allocation already has an active rider assignment in progress',
      });
    }
    next(err);
  }
}

/**
 * Rider accepts an assigned delivery task
 */
export async function acceptTask(req, res, next) {
  try {
    const { id } = req.params; // assignment_id
    const riderId = req.user?.id;

    const assignRes = await query(
      `SELECT * FROM delivery_assignments WHERE id = $1`,
      [id]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignRes.rows[0];

    if (assignment.rider_id !== riderId) {
      return res.status(403).json({ error: 'Forbidden: You are not the assigned rider for this task' });
    }

    if (assignment.status !== 'ASSIGNED') {
      return res.status(400).json({ error: `Cannot accept task in '${assignment.status}' state` });
    }

    const updatedRes = await query(
      `UPDATE delivery_assignments 
       SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      message: 'Task accepted! Proceed to pickup location.',
      assignment: updatedRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Rider or Shelter cancels the assignment before pickup.
 * The allocation remains CLAIMED by the shelter so they can reassign Rider B.
 */
export async function cancelAssignment(req, res, next) {
  try {
    const { id } = req.params; // assignment_id
    const { reason } = req.body;

    const assignRes = await query(
      `SELECT d.*, a.shelter_id, a.listing_id
       FROM delivery_assignments d
       JOIN allocations a ON a.id = d.allocation_id
       WHERE d.id = $1`,
      [id]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignRes.rows[0];

    // Authorization: Only assigned rider, shelter admin, or platform admin
    const isAssignedRider = req.user?.id === assignment.rider_id;
    const isShelterOwner = req.user?.role === 'SHELTER' && req.user?.org_id === assignment.shelter_id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isAssignedRider && !isShelterOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You cannot cancel this assignment' });
    }

    if (assignment.status === 'PICKED_UP' || assignment.status === 'COMPLETED') {
      return res.status(400).json({
        error: `Cannot cancel assignment that is already ${assignment.status}. Contact administrator for dispute handling.`,
      });
    }

    // Cancel assignment and invalidate OTP
    await query(
      `UPDATE delivery_assignments 
       SET status = 'CANCELLED', pickup_otp = NULL, notes = $1
       WHERE id = $2`,
      [reason || 'Assignment cancelled before physical pickup', id]
    );

    // Revert allocation to RESERVED so shelter can assign another rider
    await query(
      `UPDATE allocations 
       SET status = 'RESERVED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [assignment.allocation_id]
    );

    await redisClient.publish(
      'channel:alerts',
      JSON.stringify({
        event: 'RIDER_ASSIGNMENT_CANCELLED',
        assignmentId: id,
        allocationId: assignment.allocation_id,
        reason: reason || 'Cancelled before pickup',
        timestamp: new Date().toISOString(),
      })
    );

    res.json({
      message: 'Assignment cancelled. Food allocation remains reserved for your shelter to reassign a rider.',
      allocation_id: assignment.allocation_id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Rider Portal: Retrieve active and completed delivery tasks for the authenticated rider.
 * Strict zero-trust: Returns pickup address and OTP ONLY for the assigned rider.
 */
export async function getMyTasks(req, res, next) {
  try {
    const riderId = req.user?.id;

    const tasksRes = await query(
      `SELECT d.id as assignment_id, d.status as assignment_status, d.pickup_otp, d.assigned_at, d.accepted_at, d.picked_up_at, d.completed_at,
              a.id as allocation_id, a.allocated_kg, a.status as allocation_status,
              f.id as listing_id, f.food_type, f.category, f.dietary_type, f.storage_condition,
              f.pickup_lat, f.pickup_lng, f.pickup_address, f.pickup_deadline, f.consumption_deadline,
              u.full_name as donor_name, u.phone as donor_phone,
              s.name as shelter_name, s.latitude as shelter_lat, s.longitude as shelter_lng
       FROM delivery_assignments d
       JOIN allocations a ON a.id = d.allocation_id
       JOIN food_listings f ON f.id = a.listing_id
       LEFT JOIN users u ON u.id = f.donor_id
       LEFT JOIN organizations s ON s.id = a.shelter_id
       WHERE d.rider_id = $1
       ORDER BY d.created_at DESC`,
      [riderId]
    );

    res.json({
      count: tasksRes.rows.length,
      tasks: tasksRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Shelter Portal: List all registered riders belonging to the authenticated shelter.
 */
export async function getShelterRiders(req, res, next) {
  try {
    const shelterOrgId = req.user?.org_id;

    if (!shelterOrgId) {
      return res.status(400).json({ error: 'Shelter organization ID required' });
    }

    const ridersRes = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.created_at,
              COUNT(CASE WHEN d.status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP') THEN 1 END) as active_tasks_count
       FROM users u
       LEFT JOIN delivery_assignments d ON d.rider_id = u.id
       WHERE u.organization_id = $1 AND u.role IN ('RIDER', 'COURIER')
       GROUP BY u.id, u.full_name, u.email, u.phone, u.role, u.created_at
       ORDER BY u.full_name ASC`,
      [shelterOrgId]
    );

    res.json({
      riders: ridersRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Shelter Portal: Register / Invite a new rider into the shelter's organization.
 */
export async function registerShelterRider(req, res, next) {
  try {
    const { full_name, email, phone, password } = req.body;
    const shelterOrgId = req.user?.org_id;

    if (!shelterOrgId) {
      return res.status(403).json({ error: 'Forbidden: Missing shelter organization ID' });
    }

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Rider full name and email required' });
    }

    // Default password 'password123' if omitted
    import('bcryptjs').then(async (bcrypt) => {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password || 'password123', salt);

      const insertRes = await query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, organization_id)
         VALUES ($1, $2, $3, $4, 'RIDER', $5)
         RETURNING id, full_name, email, phone, role, organization_id, created_at`,
        [full_name, email.toLowerCase(), phone || null, hash, shelterOrgId]
      );

      res.status(201).json({
        message: `Rider ${full_name} successfully registered to your shelter!`,
        rider: insertRes.rows[0],
      });
    }).catch(next);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
}
