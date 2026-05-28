import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { hashPassword, verifyPassword } from '../db';
import { signToken } from '../middleware/auth';

const router = Router();

// GET /api/auth/status — check if system is initialized
router.get('/status', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  res.json({ initialized: users.count > 0 });
});

// POST /api/auth/register — user registration (first user becomes admin)
router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: '密码至少6位' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }

  const id = uuid();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, username.trim(), passwordHash, now);

  const token = signToken({ userId: id, username: username.trim() });
  res.status(201).json({ token });
});

// POST /api/auth/setup — first-time admin creation (legacy, kept for compat)
router.post('/setup', async (req: Request, res: Response) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (users.count > 0) {
    res.status(403).json({ error: '系统已初始化' });
    return;
  }

  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: '密码至少6位' });
    return;
  }

  const id = uuid();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, username.trim(), passwordHash, now);

  const token = signToken({ userId: id, username: username.trim() });
  res.status(201).json({ token });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token });
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
