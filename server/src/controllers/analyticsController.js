import { query } from '../config/database.js';

/**
 * =============================================================
 * RESCUEGRID PERSISTED METRICS & ANALYTICS CONTROLLER
 * Evaluates real outcomes directly from durable PostgreSQL records.
 * =============================================================
 */
export async function getSystemMetrics(req, res, next) {
  try {
    // 1. Listing & Volume Metrics
    const listingStats = await query(`
      SELECT 
        COUNT(*) as total_posted,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed_deliveries,
        COUNT(*) FILTER (WHERE status = 'CLAIMED') as claimed_active,
        COUNT(*) FILTER (WHERE status = 'IN_TRANSIT') as in_transit_active,
        COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_count,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available_count,
        COALESCE(SUM(quantity_kg), 0)::numeric(10,2) as total_kg_posted,
        COALESCE(SUM(quantity_kg) FILTER (WHERE status = 'DELIVERED'), 0)::numeric(10,2) as total_kg_delivered
      FROM food_listings
    `);

    // 2. On-Time & Operational Duration Metrics
    const auditStats = await query(`
      SELECT 
        COUNT(*) as completed_audits,
        COUNT(*) FILTER (WHERE h.delivery_time <= COALESCE(f.consumption_deadline, f.expires_at)) as on_time_deliveries,
        ROUND(AVG(EXTRACT(EPOCH FROM (h.pickup_time - f.created_at)) / 60)::numeric, 1) as avg_minutes_to_pickup,
        ROUND(AVG(EXTRACT(EPOCH FROM (h.delivery_time - h.pickup_time)) / 60)::numeric, 1) as avg_transit_duration_minutes
      FROM handover_audits h
      JOIN food_listings f ON f.id = h.listing_id
      WHERE h.delivery_time IS NOT NULL
    `);

    // 3. Recipient Demand Fulfillment Metrics
    const demandStats = await query(`
      SELECT
        COUNT(*) as total_demand_requests,
        COUNT(*) FILTER (WHERE status = 'FULFILLED') as fulfilled_requests,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_pending_requests,
        COALESCE(SUM(quantity_kg), 0)::numeric(10,2) as total_kg_demanded,
        COALESCE(SUM(quantity_kg) FILTER (WHERE status = 'FULFILLED'), 0)::numeric(10,2) as total_kg_demand_fulfilled
      FROM recipient_requests
    `);

    const ls = listingStats.rows[0];
    const as_ = auditStats.rows[0];
    const ds = demandStats.rows[0];

    const totalPosted = parseInt(ls.total_posted, 10);
    const completed = parseInt(ls.completed_deliveries, 10);
    const onTime = parseInt(as_.on_time_deliveries, 10);
    const completedAudits = parseInt(as_.completed_audits, 10);

    const fulfillmentRate = totalPosted > 0 ? parseFloat(((completed / totalPosted) * 100).toFixed(1)) : 0;
    const onTimeRate = completedAudits > 0 ? parseFloat(((onTime / completedAudits) * 100).toFixed(1)) : 100.0;
    const totalKgDelivered = parseFloat(ls.total_kg_delivered);

    // Documented conversion models (Clearly labelled as estimates)
    const estimatedMeals = Math.round(totalKgDelivered / 0.5); // Standard FAO metric: 0.5kg per meal portion
    const estimatedCo2SavedKg = parseFloat((totalKgDelivered * 2.5).toFixed(1)); // 2.5kg CO2e avoided per 1kg surplus rescued

    res.json({
      metrics: {
        donations_posted: totalPosted,
        completed_deliveries: completed,
        active_in_transit: parseInt(ls.in_transit_active, 10),
        active_claimed: parseInt(ls.claimed_active, 10),
        expired_donations: parseInt(ls.expired_count, 10),
        available_donations: parseInt(ls.available_count, 10),
        quantity_posted_kg: parseFloat(ls.total_kg_posted),
        quantity_delivered_kg: totalKgDelivered,
        fulfillment_rate_percent: fulfillmentRate,
        on_time_delivery_rate_percent: onTimeRate,
        avg_minutes_to_pickup: parseFloat(as_.avg_minutes_to_pickup) || 0,
        avg_transit_duration_minutes: parseFloat(as_.avg_transit_duration_minutes) || 0,
        demand: {
          total_requests: parseInt(ds.total_demand_requests, 10),
          fulfilled_requests: parseInt(ds.fulfilled_requests, 10),
          active_requests: parseInt(ds.active_pending_requests, 10),
          total_kg_demanded: parseFloat(ds.total_kg_demanded),
          total_kg_fulfilled: parseFloat(ds.total_kg_demand_fulfilled),
        },
        impact_estimates: {
          estimated_meals_distributed: estimatedMeals,
          estimated_co2_averted_kg: estimatedCo2SavedKg,
          methodology_note: 'Estimates based on 0.5 kg/meal standard nutritional portion and 2.5 kg CO2e landfill avoidance factor.',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
