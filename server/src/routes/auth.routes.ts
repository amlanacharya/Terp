import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired, signToken, UserRole } from '../middleware/auth';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean | number;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

const router = Router();

function normalizeProfile(row: ProfileRow): ProfileRow {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}

function getProfileByEmail(email: string): ProfileRow | undefined {
  const row = getDb()
    .prepare(
      `
        SELECT id, email, full_name, role, phone, is_active, password_hash, created_at, updated_at
        FROM profiles
        WHERE email = $email
        LIMIT 1
      `
    )
    .get({ email }) as ProfileRow | undefined;

  return row ? normalizeProfile(row) : undefined;
}

function getProfileById(id: string): ProfileRow | undefined {
  const row = getDb()
    .prepare(
      `
        SELECT id, email, full_name, role, phone, is_active, password_hash, created_at, updated_at
        FROM profiles
        WHERE id = $id
        LIMIT 1
      `
    )
    .get({ id }) as ProfileRow | undefined;

  return row ? normalizeProfile(row) : undefined;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

async function ensureBcryptPassword(profileId: string, password: string, passwordHash: string): Promise<void> {
  if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$')) {
    return;
  }

  const nextHash = await bcrypt.hash(password, 10);
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET password_hash = $password_hash,
            updated_at = datetime('now')
        WHERE id = $id
      `
    )
    .run({ password_hash: nextHash, id: profileId });
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  try {
    const profile = getProfileByEmail(email.toLowerCase());

    if (!profile || !profile.is_active) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const passwordMatches = await verifyPassword(password, profile.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    await ensureBcryptPassword(profile.id, password, profile.password_hash);

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
    const existing = getDb()
      .prepare('SELECT id FROM profiles WHERE email = $email LIMIT 1')
      .get({ email: email.toLowerCase() }) as { id: string } | undefined;

    if (existing) {
      res.status(409).json({ message: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `
          INSERT INTO profiles (
            id, email, full_name, role, phone, password_hash, is_active, created_at, updated_at, version
          ) VALUES (
            $id, $email, $full_name, 'viewer', $phone, $password_hash, 1, $created_at, $updated_at, 1
          )
        `
      )
      .run({
        id,
        email: email.toLowerCase(),
        full_name: fullName,
        phone: phone ?? null,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      });

    const profile = getProfileById(id);
    if (!profile) {
      res.status(500).json({ message: 'Unable to create the account.' });
      return;
    }

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
    const profile = req.user?.id ? getProfileById(req.user.id) : undefined;
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
