import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pbkdf2Sync } from 'crypto';
import { getOne, run, getAll } from '../db/database';
import { generateToken } from '../middleware/auth';
import { User, LoginRequest } from '../types/models';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha256';
const SALT = 'thufu-salt-v1';

function hashPassword(password: string): string {
  return pbkdf2Sync(password, SALT, ITERATIONS, 32, DIGEST).toString('hex');
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const test = pbkdf2Sync(password, SALT, ITERATIONS, 32, DIGEST).toString('hex');
    return test === storedHash;
  } catch {
    return false;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  const user = getOne<User>(
    'SELECT * FROM users WHERE email = ? AND is_active = 1',
    [email]
  );

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = verifyPassword(password, user.password);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url
      }
    }
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, full_name, phone, tenant_id }: {
    email: string; password: string; full_name: string; phone?: string; tenant_id: string;
  } = req.body;

  if (!email || !password || !full_name || !tenant_id) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  const existing = getOne<User>('SELECT id FROM users WHERE email = ? AND tenant_id = ?', [email, tenant_id]);
  if (existing) {
    res.status(409).json({ success: false, error: 'User with this email already exists' });
    return;
  }

  const hashed = hashPassword(password);
  const userId = uuidv4();

  run(
    `INSERT INTO users (id, tenant_id, email, password, full_name, phone, role)
     VALUES (?, ?, ?, ?, ?, ?, 'surveyor')`,
    [userId, tenant_id, email, hashed, full_name, phone || null]
  );

  const token = generateToken({
    userId,
    tenantId: tenant_id,
    role: 'surveyor',
    email
  });

  res.status(201).json({
    success: true,
    data: { token, user: { id: userId, email, full_name, phone, role: 'surveyor', avatar_url: null } }
  });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = getOne<User>('SELECT * FROM users WHERE id = ?', [req.user!.userId]);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      id: user.id, email: user.email, full_name: user.full_name,
      phone: user.phone, role: user.role, avatar_url: user.avatar_url
    }
  });
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const total = getOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM users WHERE tenant_id = ?',
    [req.tenantId]
  )?.total || 0;
  const rows = getAll(
    'SELECT id, email, full_name, phone, role, avatar_url, is_active, created_at FROM users WHERE tenant_id = ?',
    [req.tenantId]
  );
  res.json({ success: true, data: rows, pagination: { total, page: 1, limit: 100, pages: 1 } });
}
