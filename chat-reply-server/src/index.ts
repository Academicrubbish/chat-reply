import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb, default as db } from './db';
import { buildSystemPrompt, buildQuickPrompt } from './prompt';
import { chatCompletion, chatCompletionStream, getAvailableModels } from './llm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chat-reply-dev-secret-change-in-prod';

function signToken(payload: { userId: string; username: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function authMiddleware(req: any, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '认证失败，请重新登录' });
    return;
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '认证失败，请重新登录' });
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ===== Auth Routes (no JWT required) =====
app.get('/api/auth/status', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  res.json({ initialized: users.count > 0 });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) { res.status(400).json({ error: '用户名和密码不能为空' }); return; }
  if (password.length < 6) { res.status(400).json({ error: '密码至少6位' }); return; }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) { res.status(409).json({ error: '用户名已存在' }); return; }
  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username.trim(), passwordHash, now);
  const token = signToken({ userId: id, username: username.trim() });
  res.status(201).json({ token });
});

app.post('/api/auth/setup', async (req: Request, res: Response) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (users.count > 0) { res.status(403).json({ error: '系统已初始化' }); return; }
  const { username, password } = req.body;
  if (!username?.trim() || !password) { res.status(400).json({ error: '用户名和密码不能为空' }); return; }
  if (password.length < 6) { res.status(400).json({ error: '密码至少6位' }); return; }
  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username.trim(), passwordHash, now);
  const token = signToken({ userId: id, username: username.trim() });
  res.status(201).json({ token });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) { res.status(400).json({ error: '用户名和密码不能为空' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) { res.status(401).json({ error: '用户名或密码错误' }); return; }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { res.status(401).json({ error: '用户名或密码错误' }); return; }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// JWT middleware for all /api/* routes except /api/auth/*
app.use('/api', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/auth')) return next();
  if (req.path === '/health') return next();
  if (req.path === '/models') return next();
  authMiddleware(req, res, next);
});

// Models
app.get('/api/models', (_req: Request, res: Response) => {
  res.json({ models: getAvailableModels() });
});

// ===== Targets CRUD =====
app.get('/api/targets', (req: any, res: Response) => {
  const targets = db.prepare('SELECT * FROM chat_targets WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  res.json(targets);
});

app.post('/api/targets', (req: any, res: Response) => {
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: '名字不能为空' }); return; }
  const id = uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO chat_targets (id, user_id, name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.userId, name.trim(), meet_scene || '', persona || '', hobbies || '', recent_chats || '', tone_level || 'moderate', goal_intent || 'pursuing', forbidden_topics || '', now);
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(id);
  res.status(201).json(target);
});

app.get('/api/targets/:id', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  res.json(target);
});

app.put('/api/targets/:id', (req: any, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!existing) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const { name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics } = req.body;
  db.prepare(`
    UPDATE chat_targets SET name = ?, meet_scene = ?, persona = ?, hobbies = ?, recent_chats = ?, tone_level = ?, goal_intent = ?, forbidden_topics = ?
    WHERE id = ? AND user_id = ?
  `).run(
    name?.trim() ?? existing.name, meet_scene ?? existing.meet_scene, persona ?? existing.persona,
    hobbies ?? existing.hobbies, recent_chats ?? existing.recent_chats, tone_level ?? existing.tone_level,
    goal_intent ?? existing.goal_intent, forbidden_topics ?? existing.forbidden_topics, req.params.id, req.user.userId
  );
  res.json(db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.id));
});

app.delete('/api/targets/:id', (req: any, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
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
function verifyTargetOwnership(targetId: string, userId: string): boolean {
  return !!db.prepare('SELECT id FROM chat_targets WHERE id = ? AND user_id = ?').get(targetId, userId);
}

function verifySessionOwnership(sessionId: string, userId: string): boolean {
  const session = db.prepare('SELECT target_id FROM ai_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) return false;
  return verifyTargetOwnership(session.target_id, userId);
}

app.get('/api/targets/:id/messages', (req: any, res: Response) => {
  if (!verifyTargetOwnership(req.params.id, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  res.json(db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at ASC').all(req.params.id));
});

app.post('/api/targets/:id/messages', (req: any, res: Response) => {
  if (!verifyTargetOwnership(req.params.id, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const { role, text, source, strategy, session_id } = req.body;
  if (!role || !text?.trim()) { res.status(400).json({ error: 'role 和 text 必填' }); return; }
  if (!['her', 'me', 'scene'].includes(role)) { res.status(400).json({ error: 'role 必须为 her、me 或 scene' }); return; }
  const id = uuid();
  const now = Date.now();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.id, role, text.trim(), source || '手动输入', strategy || null, session_id || null, now);
  res.status(201).json(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id));
});

app.delete('/api/targets/:id/messages', (req: any, res: Response) => {
  if (!verifyTargetOwnership(req.params.id, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/messages/:id', (req: any, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: 'text 必填' }); return; }
  const existing = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: '消息不存在' }); return; }
  if (!verifyTargetOwnership(existing.target_id, req.user.userId)) { res.status(404).json({ error: '消息不存在' }); return; }
  db.prepare('UPDATE chat_messages SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id));
});

app.delete('/api/messages/:id', (req: any, res: Response) => {
  const existing = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: '消息不存在' }); return; }
  if (!verifyTargetOwnership(existing.target_id, req.user.userId)) { res.status(404).json({ error: '消息不存在' }); return; }
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== Sessions =====
app.get('/api/targets/:id/sessions', (req: any, res: Response) => {
  if (!verifyTargetOwnership(req.params.id, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  res.json(db.prepare('SELECT * FROM ai_sessions WHERE target_id = ? ORDER BY created_at DESC').all(req.params.id));
});

app.post('/api/targets/:id/sessions', (req: any, res: Response) => {
  const targetId = req.params.id;
  if (!verifyTargetOwnership(targetId, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
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

app.get('/api/sessions/:sessionId/messages', (req: any, res: Response) => {
  if (!verifySessionOwnership(req.params.sessionId, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }
  res.json(db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(req.params.sessionId));
});

app.get('/api/sessions/:sessionId/selections', (req: any, res: Response) => {
  if (!verifySessionOwnership(req.params.sessionId, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }
  res.json(db.prepare('SELECT * FROM reply_selections WHERE session_id = ? ORDER BY created_at ASC').all(req.params.sessionId));
});

app.delete('/api/sessions/:sessionId', (req: any, res: Response) => {
  if (!verifySessionOwnership(req.params.sessionId, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  db.transaction(() => {
    db.prepare('DELETE FROM ai_messages WHERE session_id = ?').run(req.params.sessionId);
    db.prepare('DELETE FROM ai_sessions WHERE id = ?').run(req.params.sessionId);
    if (session.is_active === 1) {
      const latest = db.prepare('SELECT id FROM ai_sessions WHERE target_id = ? ORDER BY created_at DESC LIMIT 1').get(session.target_id) as any;
      if (latest) {
        db.prepare('UPDATE ai_sessions SET is_active = 1 WHERE id = ?').run(latest.id);
      }
    }
  })();
  res.json({ success: true });
});

// ===== Shared JSON Parser =====

const SAFE_FALLBACK = {
  analysis: {
    stage: '分析中', signal: '模糊', strategy: '安全回复',
    signalText: 'AI 返回格式异常，已降级处理', emotions: [],
    tip: '建议重新生成', favorability: 50, favorabilityReason: '',
  },
  plan: { goal: '维持当前关系', nextStep: '继续对话' },
  replies: [{ id: 1, strategy: '安全回复', text: '嗯嗯，确实', reason: '降级兜底回复' }],
};

function parseJsonSafely(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '');
  try { return JSON.parse(stripped); } catch {}
  const noChineseQuotes = stripped.replace(/[""]/g, '"');
  try { return JSON.parse(noChineseQuotes); } catch {}
  const firstBrace = noChineseQuotes.indexOf('{');
  const lastBrace = noChineseQuotes.lastIndexOf('}');
  if (firstBrace === -1) return null;
  let jsonStr = lastBrace > firstBrace
    ? noChineseQuotes.slice(firstBrace, lastBrace + 1)
    : noChineseQuotes.slice(firstBrace);
  jsonStr = jsonStr.replace(/[\x00-\x1f]/g, '').replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(jsonStr); } catch {}
  let salvage = jsonStr;
  const quoteCount = (salvage.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) salvage += '"';
  const openBrackets = (salvage.match(/\[/g) || []).length - (salvage.match(/\]/g) || []).length;
  const openBraces = (salvage.match(/\{/g) || []).length - (salvage.match(/\}/g) || []).length;
  for (let i = 0; i < openBrackets; i++) salvage += ']';
  for (let i = 0; i < openBraces; i++) salvage += '}';
  salvage = salvage.replace(/,\s*([}\]])/g, '$1');
  try {
    const result = JSON.parse(salvage);
    console.log('[LLM] Salvaged truncated JSON successfully');
    return result;
  } catch {}
  return null;
}

// ===== Compact Quick Mode Normalizer =====

function normalizeCompactResponse(parsed: any) {
  // Detect compact format: replies use short keys s/t instead of strategy/text
  if (!parsed.replies?.[0]?.s) return parsed; // not compact, return as-is
  return {
    signal: parsed.signal || '模糊',
    fav: parsed.fav ?? 50,
    ctx: parsed.ctx || '',
    analysis: {
      stage: '', signal: parsed.signal || '模糊', strategy: '',
      signalText: '', emotions: [], tip: '',
      favorability: parsed.fav ?? 50, favorabilityReason: '',
    },
    replies: (parsed.replies || []).map((r: any, i: number) => ({
      id: i + 1, strategy: r.s || '安全回复', text: r.t || '', reason: '',
    })),
  };
}

// ===== Incremental Reply Extractor (for progressive streaming) =====

function extractNewReplies(raw: string, alreadySent: number): any[] {
  const repliesIdx = raw.indexOf('"replies"');
  if (repliesIdx === -1) return [];
  const arrStart = raw.indexOf('[', repliesIdx);
  if (arrStart === -1) return [];

  let depth = 0, inStr = false, esc = false, objStart = -1;
  const found: any[] = [];

  for (let i = arrStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { found.push(JSON.parse(raw.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) break;
  }
  return found.slice(alreadySent);
}

// ===== AI Generate Core =====
app.post('/api/sessions/:sessionId/generate', async (req: any, res: Response) => {
  try {
    const { herMessage, provider, mode } = req.body;
    if (!herMessage?.trim()) { res.status(400).json({ error: '消息不能为空' }); return; }
    const isQuick = mode === 'quick';

    const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
    if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(session.target_id) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

    const now = Date.now();

    // Read context (her message already saved by frontend via sendHerMessage)
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
    const promptParams = { target, recentMessages, planGoal: session.plan_goal, planNextStep: session.plan_next_step, feedbackPreferences: feedbackPrefs } as any;
    const systemPrompt = isQuick
      ? buildQuickPrompt({ ...promptParams, contextSummary: session.context_summary || '' })
      : buildSystemPrompt(promptParams);

    // Build conversation messages for AI
    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (!isQuick) {
      for (const aiMsg of aiMessages as any[]) {
        conversationMessages.push({ role: aiMsg.role as string, content: aiMsg.content as string });
      }
    }
    conversationMessages.push({ role: 'user', content: `对方的最新消息是：${herMessage}` });

    // Estimate tokens: byte-based estimation handles mixed CJK/English well
    // UTF-8: CJK = 3 bytes/char (~1.5 tokens), ASCII = 1 byte/char (~0.25 tokens)
    // Empirically ~2 bytes per token is a good middle ground
    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(Buffer.byteLength(totalText, 'utf-8') / 2);

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Steps: quick mode skips analyze/parsing, goes straight to generating
    if (!isQuick) send('step', { step: 'analyze' });

    let raw = '';
    send('step', { step: 'generating' });

    // Heartbeat timer: send every 2s while stream is active
    const heartbeatTimer = setInterval(() => {
      send('heartbeat', { ts: Date.now() });
    }, 2000);

    try {
      let sentReplyCount = 0;
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, isQuick ? 2048 : 4096)) {
        raw += delta;
        send('delta', { text: delta });

        // Quick mode only: progressively detect and send complete replies
        if (isQuick) {
          const newReplies = extractNewReplies(raw, sentReplyCount);
          for (const r of newReplies) {
            const reply = r.s !== undefined
              ? { id: sentReplyCount + 1, strategy: r.s || '安全回复', text: r.t || '', reason: '' }
              : r;
            send('reply_ready', { reply, index: sentReplyCount });
            sentReplyCount++;
          }
        }
      }
    } finally {
      clearInterval(heartbeatTimer);
    }

    // Step 3: Parse response with multi-round fallback
    if (!isQuick) send('step', { step: 'parsing' });

    console.log('[LLM Raw] length:', raw.length, 'preview:', raw.slice(0, 300));

    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[LLM Parse Error] All fallback attempts failed. Raw:', raw.slice(0, 500));
      parsed = SAFE_FALLBACK;
      console.log('[LLM] Using safe fallback response');
    }

    // Quick mode: normalize compact format (s/t → strategy/text)
    let quickCtx = '';
    if (isQuick) {
      const normalized = normalizeCompactResponse(parsed);
      quickCtx = normalized.ctx || '';
      parsed = normalized;
    }

    console.log('[LLM Parsed] keys:', Object.keys(parsed), 'replies count:', parsed.replies?.length ?? 0);

    // Safety net: ensure analysis exists (prompt should provide it, but defend against AI non-compliance)
    if (!parsed.analysis) {
      parsed.analysis = {
        stage: '分析中', signal: '模糊', strategy: '安全回复',
        signalText: 'AI 未返回分析，已降级处理', emotions: [],
        tip: '建议重新生成', favorability: 50, favorabilityReason: '',
      };
    }

    // Send structured events — normal mode sends analysis/plan/replies; quick mode already sent reply_ready during streaming
    if (!isQuick) {
      if (parsed.analysis) send('analysis', parsed.analysis);
      if (parsed.plan) send('plan', parsed.plan);
      send('replies', parsed.replies || []);
    }

    const maxTokens = 8000;
    const contextUsage = { estimatedTokens, maxTokens, percentage: Math.min(Math.round(estimatedTokens / maxTokens * 100), 100) };

    // Save to DB
    const roundId = uuid();
    const userAiMsgId = uuid();
    const assistantAiMsgId = uuid();
    db.transaction(() => {
      db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userAiMsgId, session.id, 'user', JSON.stringify({ herMessage }), roundId, 1, now);
      db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(assistantAiMsgId, session.id, 'assistant', JSON.stringify(parsed), roundId, 1, now + 1);
      const newRoundCount = session.round_count + 1;
      const newPlanGoal = parsed.plan?.goal || session.plan_goal;
      const newPlanNextStep = parsed.plan?.nextStep || session.plan_next_step;
      // Quick mode: also save context_summary; normal mode: original SQL unchanged
      if (isQuick) {
        db.prepare('UPDATE ai_sessions SET round_count = ?, context_tokens = ?, plan_goal = ?, plan_next_step = ?, context_summary = ? WHERE id = ?')
          .run(newRoundCount, estimatedTokens, newPlanGoal, newPlanNextStep, quickCtx || session.context_summary, session.id);
      } else {
        db.prepare('UPDATE ai_sessions SET round_count = ?, context_tokens = ?, plan_goal = ?, plan_next_step = ? WHERE id = ?')
          .run(newRoundCount, estimatedTokens, newPlanGoal, newPlanNextStep, session.id);
      }
    })();

    send('done', { contextUsage, roundId, version: 1 });
    res.end();
  } catch (err: any) {
    console.error('Generate error:', err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || 'AI 服务异常' })}\n\n`);
      res.end();
    } catch {
      // connection already closed
    }
  }
});

// ===== Reply Actions =====
app.post('/api/sessions/:sessionId/select-reply', (req: any, res: Response) => {
  const { replyId, aiMessageId } = req.body;
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  // Get the specific assistant message (version-aware) or fall back to last one
  let aiMsg: any;
  if (aiMessageId) {
    aiMsg = db.prepare('SELECT * FROM ai_messages WHERE id = ? AND session_id = ? AND role = ?')
      .get(aiMessageId, req.params.sessionId, 'assistant');
  } else {
    aiMsg = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
      .get(req.params.sessionId, 'assistant');
  }
  if (!aiMsg) { res.status(400).json({ error: '没有可用的回复' }); return; }

  let parsed: any;
  try { parsed = JSON.parse(aiMsg.content); } catch { res.status(500).json({ error: '解析失败' }); return; }

  const reply = (parsed.replies || []).find((r: any) => r.id === replyId);
  if (!reply) { res.status(400).json({ error: '回复不存在' }); return; }

  const chatMsgId = uuid();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(chatMsgId, session.target_id, 'me', reply.text, 'AI建议', reply.strategy, session.id, Date.now());

  // Track selection explicitly
  db.prepare(`INSERT INTO reply_selections (id, session_id, ai_message_id, reply_id, reply_text, strategy, chat_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuid(), req.params.sessionId, aiMsg.id, replyId, reply.text, reply.strategy, chatMsgId, Date.now());

  res.json({ success: true, messageId: chatMsgId });
});

app.post('/api/sessions/:sessionId/custom-reply', (req: any, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: '回复不能为空' }); return; }
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  const id = uuid();
  db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, session.target_id, 'me', text.trim(), '自定义回复', null, session.id, Date.now());
  res.json({ success: true, messageId: id });
});

app.post('/api/sessions/:sessionId/regenerate', async (req: any, res: Response) => {
  try {
    const { preferredStrategy, provider, mode, roundId: requestedRoundId } = req.body;
    const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
    if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

    const isQuick = mode === 'quick';

    // Determine round_id and next version
    let roundId: string;
    let nextVersion: number;
    if (requestedRoundId) {
      roundId = requestedRoundId;
      const maxVer = db.prepare('SELECT MAX(version) as max_ver FROM ai_messages WHERE session_id = ? AND round_id = ?')
        .get(session.id, roundId) as any;
      nextVersion = (maxVer?.max_ver || 0) + 1;
    } else {
      const lastAssistant = db.prepare('SELECT round_id, version FROM ai_messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
        .get(session.id, 'assistant') as any;
      roundId = lastAssistant?.round_id || uuid();
      nextVersion = (lastAssistant?.version || 0) + 1;
    }

    // Append user message requesting regeneration
    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), session.id, 'user', JSON.stringify({ type: 'regenerate', preferredStrategy }), roundId, nextVersion, Date.now());

    // Re-run generate logic (simplified: redirect to generate with last her message)
    const lastHerMsg = db.prepare(`SELECT * FROM chat_messages WHERE target_id = ? AND role = 'her' ORDER BY created_at DESC LIMIT 1`)
      .get(session.target_id) as any;
    if (!lastHerMsg) { res.status(400).json({ error: '没有对方消息' }); return; }

    // Just re-call the same logic
    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(session.target_id) as any;
    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 15').all(session.target_id).reverse();
    const aiMessages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC').all(session.id);

    const promptParams = { target, recentMessages, planGoal: session.plan_goal, planNextStep: session.plan_next_step, feedbackPreferences: '' } as any;
    const systemPrompt = isQuick
      ? buildQuickPrompt({ ...promptParams, contextSummary: session.context_summary || '' })
      : buildSystemPrompt(promptParams);
    const conversationMessages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
    if (!isQuick) {
      for (const aiMsg of aiMessages as any[]) { conversationMessages.push({ role: aiMsg.role as string, content: aiMsg.content as string }); }
    }
    conversationMessages.push({ role: 'user', content: `对方的最新消息是：${lastHerMsg.text}` });

    let raw = '';
    if (isQuick) {
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, 2048)) {
        raw += delta;
      }
    } else {
      raw = await chatCompletion(conversationMessages, provider || 'zhipu');
    }
    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[Regen Parse Error] All fallback attempts failed. Raw:', raw.slice(0, 500));
      parsed = SAFE_FALLBACK;
    }

    // Quick mode: normalize compact format
    let quickCtx = '';
    if (isQuick) {
      const normalized = normalizeCompactResponse(parsed);
      quickCtx = normalized.ctx || '';
      parsed = normalized;
    }

    // Safety net: ensure analysis exists
    if (!parsed.analysis) {
      parsed.analysis = {
        stage: '分析中', signal: '模糊', strategy: '安全回复',
        signalText: 'AI 未返回分析，已降级处理', emotions: [],
        tip: '建议重新生成', favorability: 50, favorabilityReason: '',
      };
    }

    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), session.id, 'assistant', JSON.stringify(parsed), roundId, nextVersion, Date.now());

    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(totalText.length * 2);
    // Quick mode: also save context_summary; normal mode: original SQL
    if (isQuick) {
      db.prepare('UPDATE ai_sessions SET round_count = round_count + 1, context_tokens = ?, context_summary = ? WHERE id = ?')
        .run(estimatedTokens, quickCtx || session.context_summary, session.id);
    } else {
      db.prepare('UPDATE ai_sessions SET round_count = round_count + 1, context_tokens = ? WHERE id = ?')
        .run(estimatedTokens, session.id);
    }

    res.json({
      analysis: parsed.analysis,
      plan: parsed.plan || { goal: session.plan_goal, nextStep: session.plan_next_step },
      contextUsage: { estimatedTokens, maxTokens: 8000, percentage: Math.min(Math.round(estimatedTokens / 8000 * 100), 100) },
      replies: parsed.replies || [],
      roundId,
      version: nextVersion,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI 服务异常' });
  }
});

app.post('/api/sessions/:sessionId/feedback', (req: any, res: Response) => {
  const { replyId, rating } = req.body;
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), req.params.sessionId, 'user', JSON.stringify({ type: 'feedback', replyId, rating }), Date.now());
  res.json({ success: true });
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
