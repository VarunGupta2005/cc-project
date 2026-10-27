import { query } from '../config/database.js';
import { redisClient } from '../config/redis.js';

/**
 * Fetch active recipient requirements
 */
export async function getAllRequests(req, res, next) {
  try {
    const { org_id, status } = req.query;
    let sql = `
      SELECT r.*, o.name as org_name, o.latitude, o.longitude, o.available_capacity_kg, o.can_collect
      FROM recipient_requests r
      JOIN organizations o ON o.id = r.org_id
      WHERE 1=1
    `;
    const params = [];

    if (org_id) {
      params.push(org_id);
      sql += ` AND r.org_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    } else {
      sql += ` AND r.status = 'ACTIVE'`;
    }

    sql += ` ORDER BY r.needed_by ASC`;

    const result = await query(sql, params);
    res.json({ requests: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Post a new structured recipient requirement
 */
export async function createRequest(req, res, next) {
  try {
    const {
      org_id,
      quantity_kg,
      category,
      dietary_type,
      needed_by,
      hours_valid,
    } = req.body;

    const orgId = req.user?.org_id || org_id;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    if (!quantity_kg || parseFloat(quantity_kg) <= 0) {
      return res.status(400).json({ error: 'Valid quantity in kg required' });
    }

    // Default needed_by to now + hours_valid (default 6 hrs)
    let neededByTime;
    if (needed_by) {
      neededByTime = new Date(needed_by);
    } else {
      const validHours = parseFloat(hours_valid) || 6.0;
      neededByTime = new Date(Date.now() + validHours * 3600 * 1000);
    }

    const result = await query(
      `INSERT INTO recipient_requests 
        (org_id, quantity_kg, category, dietary_type, needed_by, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       RETURNING *`,
      [
        orgId,
        parseFloat(quantity_kg),
        category || 'COOKED_MEAL',
        dietary_type || 'ANY',
        neededByTime,
      ]
    );

    const newRequest = result.rows[0];

    // Broadcast real-time requirement event via Redis Pub/Sub
    try {
      await redisClient.publish(
        'channel:alerts',
        JSON.stringify({
          event: 'DEMAND_POSTED',
          request: newRequest,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (pubErr) {}

    res.status(201).json({
      message: 'Active recipient requirement posted successfully',
      request: newRequest,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel or fulfill an existing requirement
 */
export async function cancelRequest(req, res, next) {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id;

    let updateSql = `UPDATE recipient_requests SET status = 'CANCELLED' WHERE id = $1`;
    const params = [id];

    if (orgId) {
      updateSql += ` AND org_id = $2`;
      params.push(orgId);
    }

    updateSql += ` RETURNING *`;

    const result = await query(updateSql, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requirement not found or unauthorized' });
    }

    res.json({
      message: 'Recipient requirement cancelled',
      request: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}
