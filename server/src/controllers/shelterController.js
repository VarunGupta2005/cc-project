import { query } from '../config/database.js';
import { seedShelter } from '../services/redisEngine.js';
import { rankCandidateShelters } from '../services/matchingService.js';

export async function getAllShelters(req, res, next) {
  try {
    const orgs = await query(
      `SELECT o.*, u.email, u.phone
       FROM organizations o
       JOIN users u ON u.id = o.user_id
       WHERE o.org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')
       ORDER BY o.name ASC`
    );

    // Make sure all shelters are synced to Redis geo:shelters
    for (const org of orgs.rows) {
      await seedShelter(org.id, org.longitude, org.latitude);
    }

    res.json({ shelters: orgs.rows });
  } catch (err) {
    next(err);
  }
}

export async function getRecommendedShelters(req, res, next) {
  try {
    const { lat, lng, weight_kg } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and Longitude required' });
    }

    const weight = parseFloat(weight_kg) || 20;

    const orgs = await query(
      `SELECT * FROM organizations 
       WHERE org_type IN ('SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN')
       AND is_verified = TRUE`
    );

    const ranked = rankCandidateShelters(parseFloat(lat), parseFloat(lng), orgs.rows, weight, 15);

    res.json({ recommended_shelters: ranked });
  } catch (err) {
    next(err);
  }
}
