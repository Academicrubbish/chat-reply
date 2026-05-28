import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/targets
router.get('/', (_req: Request, res: Response) => {
  const targets = db.prepare('SELECT * FROM chat_targets ORDER BY created_at DESC').all();
  res.json(targets);
});

// POST /api/targets
router.post('/', (req: Request, res: Response) => {
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: '名字不能为空' });
    return;
  }
  const id = uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO chat_targets (id, name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), meet_scene || '', persona || '', hobbies || '', recent_chats || '', tone_level || 'moderate', goal_intent || 'pursuing', forbidden_topics || '', now);
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(id);
  res.status(201).json(target);
});

// GET /api/targets/:id
router.get('/:id', (req: Request, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!target) {
    res.status(404).json({ error: '聊天对象不存在' });
    return;
  }
  res.json(target);
});

// PUT /api/targets/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '聊天对象不存在' });
    return;
  }
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  db.prepare(`
    UPDATE chat_targets SET name = ?, meet_scene = ?, persona = ?, hobbies = ?, recent_chats = ?, tone_level = ?, goal_intent = ?, forbidden_topics = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? existing.name,
    meet_scene ?? existing.meet_scene,
    persona ?? existing.persona,
    hobbies ?? existing.hobbies,
    recent_chats ?? existing.recent_chats,
    tone_level ?? existing.tone_level,
    goal_intent ?? existing.goal_intent,
    forbidden_topics ?? existing.forbidden_topics,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/targets/:id
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '聊天对象不存在' });
    return;
  }
  const deleteTx = db.transaction(() => {
    const sessionIds = db.prepare('SELECT id FROM ai_sessions WHERE target_id = ?').all(req.params.id).map(s => s.id);
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
    }
    db.prepare('DELETE FROM ai_sessions WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chat_targets WHERE id = ?').run(req.params.id);
  });
  deleteTx();
  res.json({ success: true });
});

export default router;
