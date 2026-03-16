import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, signToken, UserRole } from '../middleware/auth';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  try {
    const result = await query<ProfileRow>(
      `
        SELECT id, email, full_name, role, phone, is_active, password_hash, created_at, updated_at
        FROM profiles
        WHERE email = $1
        LIMIT 1
      `,
      [email.toLowerCase()]
    );

    const profile = result.rows[0];

    if (!profile || !profile.is_active) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, profile.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    });

    res.json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Unable to sign in right now.' });
  }
});

router.post('/signup', async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
  } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
  };

  if (!email || !password || !fullName) {
    res.status(400).json({ message: 'Email, password, and full name are required.' });
    return;
  }

  try {
    const existing = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1 LIMIT 1', [
      email.toLowerCase(),
    ]);

    if (existing.rows[0]) {
      res.status(409).json({ message: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await query<ProfileRow>(
      `
        INSERT INTO profiles (email, full_name, role, phone, password_hash)
        VALUES ($1, $2, 'viewer', $3, $4)
        RETURNING id, email, full_name, role, phone, is_active, password_hash, created_at, updated_at
      `,
      [email.toLowerCase(), fullName, phone ?? null, passwordHash]
    );

    const profile = insertResult.rows[0];
    const token = signToken({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    });

    res.status(201).json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).json({ message: 'Unable to create the account.' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await query<ProfileRow>(
      `
        SELECT id, email, full_name, role, phone, is_active, password_hash, created_at, updated_at
        FROM profiles
        WHERE id = $1
        LIMIT 1
      `,
      [req.user?.id]
    );

    const profile = result.rows[0];
    if (!profile || !profile.is_active) {
      res.status(404).json({ message: 'User profile not found.' });
      return;
    }

    res.json({
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    console.error('Fetching current user failed:', error);
    res.status(500).json({ message: 'Unable to fetch your profile.' });
  }
});

export default router;
