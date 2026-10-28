import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { seedShelter } from '../services/redisEngine.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'rescuegrid_jwt_super_secret_key_2026';

export async function register(req, res, next) {
  try {
    const { email, password, role, full_name, phone, organization } = req.body;

    if (!email || !password || !role || !full_name) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const userRes = await query(
      `INSERT INTO users (email, password_hash, role, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, full_name, phone, created_at`,
      [email.toLowerCase(), password_hash, role, full_name, phone || null]
    );

    const newUser = userRes.rows[0];
    let createdOrg = null;

    // If registering an organization (Shelter or Commercial Donor)
    if (organization && organization.name && organization.latitude && organization.longitude) {
      // In production, new organizations must be unverified until audited.
      // Demo/evaluator mode allows auto-verification if explicitly configured.
      const shouldAutoVerify = process.env.AUTO_VERIFY_ORGS === 'true' || process.env.NODE_ENV === 'test';
      const declaredCapacity = parseFloat(organization.capacity_kg) || 50.0;

      const orgRes = await query(
        `INSERT INTO organizations (user_id, name, org_type, latitude, longitude, capacity_kg, available_capacity_kg, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, org_type, latitude, longitude, capacity_kg, available_capacity_kg, is_verified`,
        [
          newUser.id,
          organization.name,
          organization.org_type || role,
          parseFloat(organization.latitude),
          parseFloat(organization.longitude),
          declaredCapacity,
          declaredCapacity,
          shouldAutoVerify,
        ]
      );
      createdOrg = orgRes.rows[0];

      // If it's a verified shelter, index coordinates into Redis immediately
      if (role === 'SHELTER' && shouldAutoVerify) {
        await seedShelter(createdOrg.id, createdOrg.longitude, createdOrg.latitude);
        console.log(`[Redis] Seeded new shelter ${createdOrg.name} into geo:shelters`);
      }
    }

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, org_id: createdOrg?.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: newUser,
      organization: createdOrg,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const userRes = await query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.full_name, u.phone,
              o.id as org_id, o.name as org_name, o.latitude, o.longitude, o.capacity_kg
       FROM users u
       LEFT JOIN organizations o ON o.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, org_id: user.org_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
      },
      organization: user.org_id
        ? {
            id: user.org_id,
            name: user.org_name,
            latitude: user.latitude,
            longitude: user.longitude,
            capacity_kg: user.capacity_kg,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    const userRes = await query(
      `SELECT u.id, u.email, u.role, u.full_name, u.phone,
              o.id as org_id, o.name as org_name, o.latitude, o.longitude, o.capacity_kg
       FROM users u
       LEFT JOIN organizations o ON o.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userRes.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateOrganization(req, res, next) {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, capacity_kg } = req.body;

    const orgRes = await query(`SELECT * FROM organizations WHERE id = $1`, [id]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const org = orgRes.rows[0];

    // Authorization: owner user or admin
    if (req.user && org.user_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: You cannot modify another organization’s profile' });
    }

    const newLat = latitude !== undefined && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : org.latitude;
    const newLng = longitude !== undefined && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : org.longitude;
    const newCap = capacity_kg !== undefined && !isNaN(parseFloat(capacity_kg)) ? parseFloat(capacity_kg) : org.capacity_kg;
    const newName = name || org.name;

    const updateRes = await query(
      `UPDATE organizations
       SET name = $1, latitude = $2, longitude = $3, capacity_kg = $4
       WHERE id = $5
       RETURNING *`,
      [newName, newLat, newLng, newCap, id]
    );

    const updatedOrg = updateRes.rows[0];

    // If verified shelter, sync coordinates to Redis geo:shelters immediately
    if (updatedOrg.is_verified && ['SHELTER', 'ORPHANAGE', 'COMMUNITY_KITCHEN'].includes(updatedOrg.org_type)) {
      await seedShelter(updatedOrg.id, updatedOrg.longitude, updatedOrg.latitude);
    }

    res.json({
      message: 'Organization profile updated successfully in PostgreSQL!',
      organization: updatedOrg,
    });
  } catch (err) {
    next(err);
  }
}
