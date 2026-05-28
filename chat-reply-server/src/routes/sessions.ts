import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/targets/:id/sessions
router.get('/targets/:id/sessions', (req: Request, res: Response) => {
  const sessions = db.prepare('SELECT * FROM ai_sessions WHERE target_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(sessions);
});

// POST /api/targets/:id/sessions
router.post('/targets/:id/sessions', (req: Request, res: Response) => {
  const targetId = req.params.id;
  const target = db.prepare('SELECT id FROM chat_targets WHERE id = ?').get(targetId);
  if (!target) {
    res.status(404).json({ error: '聊天对象不存在' });
    return;
  }
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM ai_sessions WHERE target_id = ?').get(targetId) as { count: number };
  const id = uuid();
  const title = `#${existingCount.count + 1}`;
  const now = Date.now();

  const createTx = db.transaction(() => {
    db.prepare('UPDATE ai_sessions SET is_active = 0 WHERE target_id = ?').run(targetId);
    db.prepare(`
      INSERT INTO ai_sessions (id, target_id, title, is_active, round_count, context_tokens, plan_goal, plan_next_step, created_at)
      VALUES (?, ?, ?, 1, 0, 0, '', '', ?)
    `).run(id, targetId, title, now);
  });
  createTx();

  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(id);
  res.status(201).json(session);
});

// GET /api/sessions/:sessionId/messages
router.get('/sessions/:sessionId/messages', (req: Request, res: Response) => {
  const session = db.prepare('SELECT id FROM ai_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: '辅导窗口不存在' });
    return;
  }
  const messages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(req.params.sessionId);
  res.json(messages);
});

export default router;
