import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import './db';

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from './db';
import { buildSystemPrompt } from './prompt';
import { chatCompletion } from './llm';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ===== Targets CRUD =====
app.get('/api/targets', (_req: Request, res: Response) => {
  const targets = db.prepare('SELECT * FROM chat_targets ORDER BY created_at DESC').all();
  res.json(targets);
});

app.post('/api/targets', (req: Request, res: Response) => {
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: '名字不能为空' }); return; }
  const id = uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO chat_targets (id, name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), meet_scene || '', persona || '', hobbies || '', recent_chats || '', tone_level || 'moderate', goal_intent || 'pursuing', forbidden_topics || '', now);
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(id);
  res.status(201).json(target);
});

app.get('/api/targets/:id', (req: Request, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  res.json(target);
});

app.put('/api/targets/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  db.prepare(`
    UPDATE chat_targets SET name = ?, meet_scene = ?, persona = ?, hobbies = ?, recent_chats = ?, tone_level = ?, goal_intent = ?, forbidden_topics = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? existing.name, meet_scene ?? existing.meet_scene, persona ?? existing.persona,
    hobbies ?? existing.hobbies, recent_chats ?? existing.recent_chats, tone_level ?? existing.tone_level,
    goal_intent ?? existing.goal_intent, forbidden_topics ?? existing.forbidden_topics, req.params.id
  );
  res.json(db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id));
});

app.delete('/api/targets/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  db.transaction(() => {
    const sessionIds = db.prepare('SELECT id FROM ai_sessions WHERE target_id = ?').all(req.params.id).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`).run(...sessionIds);
    }
    db.prepare('DELETE FROM ai_sessions WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chat_targets WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

// ===== Messages =====
app.get('/api/targets/:id/messages', (req: Request, res: Response) => {
  res.json(db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at ASC').all(req.params.id));
});

app.post('/api/targets/:id/messages', (req: Request, res: Response) => {
  const { role, text, source, strategy, session_id } = req.body;
  if (!role || !text?.trim()) { res.status(400).json({ error: 'role 和 text 必填' }); return; }
  if (!['her', 'me'].includes(role)) { res.status(400).json({ error: 'role 必须为 her 或 me' }); return; }
  const target = db.prepare('SELECT id FROM chat_targets WHERE id = ?').get(req.params.id);
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const id = uuid();
  const now = Date.now();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.id, role, text.trim(), source || '手动输入', strategy || null, session_id || null, now);
  res.status(201).json(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id));
});

app.delete('/api/targets/:id/messages', (req: Request, res: Response) => {
  db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/messages/:id', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: 'text 必填' }); return; }
  const existing = db.prepare('SELECT id FROM chat_messages WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: '消息不存在' }); return; }
  db.prepare('UPDATE chat_messages SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id));
});

app.delete('/api/messages/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM chat_messages WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: '消息不存在' }); return; }
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== Sessions =====
app.get('/api/targets/:id/sessions', (req: Request, res: Response) => {
  res.json(db.prepare('SELECT * FROM ai_sessions WHERE target_id = ? ORDER BY created_at DESC').all(req.params.id));
});

app.post('/api/targets/:id/sessions', (req: Request, res: Response) => {
  const targetId = req.params.id;
  const target = db.prepare('SELECT id FROM chat_targets WHERE id = ?').get(targetId);
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM ai_sessions WHERE target_id = ?').get(targetId) as any).count;
  const id = uuid();
  const title = `#${existingCount + 1}`;
  const now = Date.now();
  db.transaction(() => {
    db.prepare('UPDATE ai_sessions SET is_active = 0 WHERE target_id = ?').run(targetId);
    db.prepare(`INSERT INTO ai_sessions (id, target_id, title, is_active, round_count, context_tokens, plan_goal, plan_next_step, created_at) VALUES (?, ?, ?, 1, 0, 0, '', '', ?)`)
      .run(id, targetId, title, now);
  })();
  res.status(201).json(db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(id));
});

app.get('/api/sessions/:sessionId/messages', (req: Request, res: Response) => {
  const session = db.prepare('SELECT id FROM ai_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }
  res.json(db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(req.params.sessionId));
});

// ===== AI Generate Core =====
app.post('/api/sessions/:sessionId/generate', async (req: Request, res: Response) => {
  try {
    const { herMessage } = req.body;
    if (!herMessage?.trim()) { res.status(400).json({ error: '消息不能为空' }); return; }

    const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
    if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(session.target_id) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

    // Save her message
    const msgId = uuid();
    const now = Date.now();
    db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(msgId, target.id, 'her', herMessage.trim(), '手动输入', null, session.id, now);

    // Read context
    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 15').all(target.id).reverse();
    const aiMessages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(session.id);

    // Build feedback preferences from ai_messages
    const feedbackPrefs = aiMessages
      .filter((m: any) => m.role === 'user' && m.content.includes('反馈'))
      .map((m: any) => { try { return JSON.parse(m.content); } catch { return null; } })
      .filter(Boolean)
      .map((f: any) => `用户对${f.strategy}策略反馈${f.rating === 'thumbs_up' ? '👍' : '👎'}`)
      .join('；');

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      target,
      recentMessages,
      planGoal: session.plan_goal,
      planNextStep: session.plan_next_step,
      feedbackPreferences: feedbackPrefs,
    });

    // Build conversation messages for AI
    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const aiMsg of aiMessages) {
      conversationMessages.push({ role: aiMsg.role, content: aiMsg.content });
    }
    conversationMessages.push({ role: 'user', content: `对方的最新消息是：${herMessage}` });

    // Estimate tokens (rough: Chinese 1 char ≈ 2 tokens)
    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(totalText.length * 2);

    // Call GLM-5.1
    const raw = await chatCompletion(conversationMessages);

    // Parse JSON response
    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 未返回有效 JSON');
      let jsonStr = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1')           // remove trailing commas
        .replace(/\/\/.*$/gm, '')                 // remove single-line comments
        .replace(/[\x00-\x1f]/g, '')             // remove control chars
        .replace(/'/g, '"');                       // try single→double quotes
      parsed = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      res.status(500).json({ error: `AI 响应解析失败: ${parseErr.message}` });
      return;
    }

    // Save AI messages
    const userAiMsgId = uuid();
    const assistantAiMsgId = uuid();
    db.transaction(() => {
      db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(userAiMsgId, session.id, 'user', JSON.stringify({ herMessage }), now);
      db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(assistantAiMsgId, session.id, 'assistant', JSON.stringify(parsed), now + 1);

      // Update session
      const newRoundCount = session.round_count + 1;
      const newPlanGoal = parsed.plan?.goal || session.plan_goal;
      const newPlanNextStep = parsed.plan?.nextStep || session.plan_next_step;
      db.prepare('UPDATE ai_sessions SET round_count = ?, context_tokens = ?, plan_goal = ?, plan_next_step = ? WHERE id = ?')
        .run(newRoundCount, estimatedTokens, newPlanGoal, newPlanNextStep, session.id);
    })();

    const maxTokens = 8000;
    res.json({
      analysis: parsed.analysis,
      plan: parsed.plan || { goal: session.plan_goal, nextStep: session.plan_next_step },
      contextUsage: { estimatedTokens, maxTokens, percentage: Math.min(Math.round(estimatedTokens / maxTokens * 100), 100) },
      replies: parsed.replies || [],
    });
  } catch (err: any) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'AI 服务异常' });
  }
});

// ===== Reply Actions =====
app.post('/api/sessions/:sessionId/select-reply', (req: Request, res: Response) => {
  const { replyId } = req.body;
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  // Get last assistant message to find the reply
  const lastAiMsg = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.params.sessionId, 'assistant') as any;
  if (!lastAiMsg) { res.status(400).json({ error: '没有可用的回复' }); return; }

  let parsed: any;
  try { parsed = JSON.parse(lastAiMsg.content); } catch { res.status(500).json({ error: '解析失败' }); return; }

  const reply = (parsed.replies || []).find((r: any) => r.id === replyId);
  if (!reply) { res.status(400).json({ error: '回复不存在' }); return; }

  const id = uuid();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, session.target_id, 'me', reply.text, 'AI建议', reply.strategy, session.id, Date.now());
  res.json({ success: true });
});

app.post('/api/sessions/:sessionId/custom-reply', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: '回复不能为空' }); return; }
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  const id = uuid();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, session.target_id, 'me', text.trim(), '自定义回复', null, session.id, Date.now());
  res.json({ success: true });
});

app.post('/api/sessions/:sessionId/regenerate', async (req: Request, res: Response) => {
  try {
    const { preferredStrategy } = req.body;
    const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
    if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

    // Append user message requesting regeneration
    const regenContent = preferredStrategy
      ? `用户不满意上次的结果，请重新生成回复。用户偏好策略：${preferredStrategy}`
      : '用户不满意上次的结果，请重新生成回复。';
    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), session.id, 'user', JSON.stringify({ type: 'regenerate', preferredStrategy }), Date.now());

    // Re-run generate logic (simplified: redirect to generate with last her message)
    const lastHerMsg = db.prepare(`SELECT * FROM chat_messages WHERE target_id = ? AND role = 'her' ORDER BY created_at DESC LIMIT 1`)
      .get(session.target_id) as any;
    if (!lastHerMsg) { res.status(400).json({ error: '没有对方消息' }); return; }

    // Just re-call the same logic
    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(session.target_id) as any;
    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 15').all(session.target_id).reverse();
    const aiMessages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(session.id);

    const systemPrompt = buildSystemPrompt({ target, recentMessages, planGoal: session.plan_goal, planNextStep: session.plan_next_step, feedbackPreferences: '' });
    const conversationMessages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
    for (const aiMsg of aiMessages) { conversationMessages.push({ role: aiMsg.role, content: aiMsg.content }); }

    const raw = await chatCompletion(conversationMessages);
    let parsed: any;
    try { const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('no json'); parsed = JSON.parse(m[0]); }
    catch (parseErr: any) { res.status(500).json({ error: `AI 响应解析失败` }); return; }

    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), session.id, 'assistant', JSON.stringify(parsed), Date.now());

    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(totalText.length * 2);
    db.prepare('UPDATE ai_sessions SET round_count = round_count + 1, context_tokens = ? WHERE id = ?')
      .run(estimatedTokens, session.id);

    res.json({
      analysis: parsed.analysis,
      plan: parsed.plan || { goal: session.plan_goal, nextStep: session.plan_next_step },
      contextUsage: { estimatedTokens, maxTokens: 8000, percentage: Math.min(Math.round(estimatedTokens / 8000 * 100), 100) },
      replies: parsed.replies || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI 服务异常' });
  }
});

app.post('/api/sessions/:sessionId/feedback', (req: Request, res: Response) => {
  const { replyId, rating } = req.body;
  const session = db.prepare('SELECT id FROM ai_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), req.params.sessionId, 'user', JSON.stringify({ type: 'feedback', replyId, rating }), Date.now());
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
