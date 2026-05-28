import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router({ mergeParams: true });

// GET /api/targets/:id/messages
router.get('/', (req: Request, res: Response) => {
  const { id } = req.params;
  const messages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at ASC').all(id);
  res.json(messages);
});

// POST /api/targets/:id/messages
router.post('/', (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, text, source, strategy, session_id } = req.body;
  if (!role || !text?.trim()) {
    res.status(400).json({ error: 'role 和 text 必填' });
    return;
  }
  if (!['her', 'me'].includes(role)) {
    res.status(400).json({ error: 'role 必须为 her 或 me' });
    return;
  }
  const target = db.prepare('SELECT id FROM chat_targets WHERE id = ?').get(id);
  if (!target) {
    res.status(404).json({ error: '聊天对象不存在' });
    return;
  }
  const msgId = uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, id, role, text.trim(), source || '手动输入', strategy || null, session_id || null, now);
  const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msgId);
  res.status(201).json(msg);
});

// DELETE /api/targets/:id/messages
router.delete('/', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(id);
  res.json({ success: true });
});

export default router;
