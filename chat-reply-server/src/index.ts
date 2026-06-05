import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb, default as db } from './db';
import { buildAdvisorPrompt, buildReviewPrompt, buildQuickMessages, buildFullMessagesOptimized } from './prompt';
import { chatCompletion, chatCompletionStream, getAvailableModels } from './llm';
import knowledgeRoutes from './routes/knowledge';
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
  // Check if registration is allowed
  const regSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('allow_registration') as any;
  if (regSetting && regSetting.value === 'false') { res.status(403).json({ error: '注册已关闭，请联系管理员' }); return; }
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

// Knowledge routes
app.use('/api/knowledge', knowledgeRoutes);

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
      const placeholders = sessionIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM reply_selections WHERE session_id IN (${placeholders})`).run(...sessionIds);
      db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
    }
    db.prepare('DELETE FROM chat_evaluations WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chat_diagnoses WHERE target_id = ?').run(req.params.id);
    db.prepare('DELETE FROM user_warnings WHERE target_id = ?').run(req.params.id);
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

app.post('/api/targets/:id/messages/batch', (req: any, res: Response) => {
  if (!verifyTargetOwnership(req.params.id, req.user.userId)) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) { res.status(400).json({ error: 'messages 必须为非空数组' }); return; }
  const insert = db.prepare(`INSERT INTO chat_messages (id, target_id, role, text, source, strategy, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = Date.now();
  let count = 0;
  db.transaction(() => {
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m.role || !m.text?.trim() || !['her', 'me', 'scene'].includes(m.role)) continue;
      insert.run(uuid(), req.params.id, m.role, m.text.trim(), m.source || '历史记录', m.strategy || null, m.session_id || null, now + i);
      count++;
    }
  })();
  res.status(201).json({ count });
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
  db.prepare('DELETE FROM reply_selections WHERE chat_message_id = ?').run(req.params.id);
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
    db.prepare('DELETE FROM reply_selections WHERE session_id = ?').run(req.params.sessionId);
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
  // 快速路径：直接解析
  try { return JSON.parse(text); } catch {}

  // ===== 路径 A：保守清洗（不替换中文引号，避免破坏字符串内的 ""）=====
  // 关键：中文引号 "" 在 JSON 字符串值内部是合法 Unicode，不应替换
  // 只在路径 B 才尝试替换中文引号（处理 LLM 用 "" 做 JSON 分隔符的情况）
  let cleaned = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/[\x00-\x1f]/g, '')   // 去控制字符（含 raw newline，JSON 不允许）
    .replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(cleaned); } catch {}

  // 提取 JSON 块
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1) return null;
  let jsonStr = cleaned.slice(firstBrace, lastBrace + 1);

  // 修复中文标点（, : ; 不破坏引号结构）
  let fixed = jsonStr.replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';');
  try { return JSON.parse(fixed); } catch {}

  // 截断修复
  try { return tryRecoverTruncated(fixed); } catch {}

  // ===== 路径 B：激进清洗（替换中文引号 "" → ""，可能解决用中文引号做 JSON 分隔符的情况）=====
  let aggressive = jsonStr.replace(/[“”]/g, '"');
  try { return JSON.parse(aggressive); } catch {}

  // 中文标点 + 激进引号
  let aggressiveFixed = aggressive.replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';');
  try { return JSON.parse(aggressiveFixed); } catch {}

  // 截断修复
  try { return tryRecoverTruncated(aggressiveFixed); } catch {}

  return null;
}

function tryRecoverTruncated(jsonStr: string): any {
  let recovered = jsonStr;
  const quoteCount = (recovered.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) recovered += '"';
  const ob = (recovered.match(/\[/g) || []).length - (recovered.match(/\]/g) || []).length;
  const oc = (recovered.match(/\{/g) || []).length - (recovered.match(/\}/g) || []).length;
  for (let i = 0; i < ob; i++) recovered += ']';
  for (let i = 0; i < oc; i++) recovered += '}';
  recovered = recovered.replace(/,\s*([}\]])/g, '$1');
  const result = JSON.parse(recovered);
  console.log('[LLM] Salvaged truncated JSON');
  return result;
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

    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(session.target_id, req.user.userId) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

    const now = Date.now();
    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 15').all(target.id).reverse();
    const aiMessages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10').all(session.id).reverse();

    // Build feedback preferences from ai_messages
    const feedbackPrefs = aiMessages
      .filter((m: any) => m.role === 'user' && m.content.includes('反馈'))
      .map((m: any) => { try { return JSON.parse(m.content); } catch { return null; } })
      .filter(Boolean)
      .map((f: any) => `用户对${f.strategy}策略反馈${f.rating === 'thumbs_up' ? '👍' : '👎'}`)
      .join('；');

    // SSE headers
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });
    const send = (event: string, data: any) => { if (!clientDisconnected) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} } };
    const heartbeatTimer = setInterval(() => { send('heartbeat', { ts: Date.now() }); }, 2000);

    // ===== Diagnosis-first: ensure diagnosis exists =====
    let diagnosis: any = null;
    if (target.active_diagnosis_id) {
      const d = db.prepare('SELECT * FROM chat_diagnoses WHERE id = ?').get(target.active_diagnosis_id) as any;
      if (d) {
        diagnosis = {
          ...d,
          warnings: JSON.parse(d.warnings_json || '[]'),
          knowledgeIds: JSON.parse(d.knowledge_ids || '[]'),
        };
      }
    }

    // No diagnosis: auto-diagnose first (non-SSE, internal call)
    if (!diagnosis) {
      send('step', { step: 'auto_diagnosing' });
      try {
        diagnosis = await runDiagnosisInternal(target, recentMessages, provider || 'zhipu');
      } catch (diagErr: any) {
        console.error('[Auto-Diagnose Error]', diagErr.message);
        // Create fallback diagnosis so frontend always has something to show
        diagnosis = {
          id: '',
          target_id: target.id,
          attitude_level: '无法判断',
          language_pattern: '无法判断',
          emotion_type: '未知',
          emotion_valence: '中性',
          stage: '信息不足',
          upgrade_ready: false,
          upgrade_reason: '',
          warnings: ['自动诊断暂时不可用，请稍后手动重新诊断'],
          action: '维持当前关系',
          strategy: '先进行轻松对话，积累更多数据后再诊断',
          knowledgeIds: [],
          created_at: Date.now(),
        };
      }
      send('diagnosis_ready', { diagnosis });
      if (diagnosis.action || diagnosis.strategy) {
        send('plan', { goal: diagnosis.action, nextStep: diagnosis.strategy });
      }
    }

    // Build prompt params with diagnosis
    const promptParams = { target, recentMessages: recentMessages as any[], planGoal: session.plan_goal, planNextStep: session.plan_next_step, feedbackPreferences: feedbackPrefs, diagnosis };

    const baseMessages = isQuick
      ? buildQuickMessages({ ...promptParams, contextSummary: session.context_summary || '' })
      : buildFullMessagesOptimized(promptParams);

    const conversationMessages: Array<{ role: string; content: string }> = [...baseMessages];
    if (!isQuick) {
      for (const aiMsg of aiMessages as any[]) {
        conversationMessages.push({ role: aiMsg.role as string, content: aiMsg.content as string });
      }
    }
    conversationMessages.push({ role: 'user', content: `对方的最新消息是：${herMessage}` });

    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(Buffer.byteLength(totalText, 'utf-8') / 2);

    // Stream reply generation
    if (!isQuick) send('step', { step: 'analyze' });
    let raw = '';
    send('step', { step: 'generating' });

    try {
      let sentReplyCount = 0;
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, isQuick ? 4096 : 8192)) {
        raw += delta;
        if (clientDisconnected) break;
        send('delta', { text: delta });

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

    if (!isQuick) send('step', { step: 'parsing' });
    console.log('[LLM Raw] length:', raw.length, 'preview:', raw.slice(0, 300));

    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[LLM Parse Error] Full raw output:\n', raw);
      // Send debug info to frontend so user can inspect in browser console
      send('debug_raw', { source: 'generate', rawLength: raw.length, rawPreview: raw.slice(0, 800) });
      parsed = SAFE_FALLBACK;
      console.log('[LLM] Using safe fallback response');
    }

    // Quick mode: normalize compact format
    let quickCtx = '';
    if (isQuick) {
      const normalized = normalizeCompactResponse(parsed);
      quickCtx = normalized.ctx || '';
      parsed = normalized;
    }

    console.log('[LLM Parsed] keys:', Object.keys(parsed), 'replies count:', parsed.replies?.length ?? 0);

    // Send structured events (diagnosis-aware: only replies, no analysis/plan needed)
    if (!isQuick) {
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
      const newPlanGoal = diagnosis?.action || session.plan_goal;
      const newPlanNextStep = diagnosis?.strategy || session.plan_next_step;
      if (isQuick) {
        db.prepare('UPDATE ai_sessions SET round_count = ?, context_tokens = ?, plan_goal = ?, plan_next_step = ?, context_summary = ?, diagnosis_id = ? WHERE id = ?')
          .run(newRoundCount, estimatedTokens, newPlanGoal, newPlanNextStep, quickCtx || session.context_summary, diagnosis?.id || null, session.id);
      } else {
        db.prepare('UPDATE ai_sessions SET round_count = ?, context_tokens = ?, plan_goal = ?, plan_next_step = ?, diagnosis_id = ? WHERE id = ?')
          .run(newRoundCount, estimatedTokens, newPlanGoal, newPlanNextStep, diagnosis?.id || null, session.id);
      }
    })();

    send('done', { contextUsage, roundId, version: 1 });
    res.end();
  } catch (err: any) {
    console.error('Generate error:', err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || 'AI 服务异常' })}\n\n`);
      res.end();
    } catch { /* connection already closed */ }
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

    // Re-run generate logic with last her message
    const lastHerMsg = db.prepare(`SELECT * FROM chat_messages WHERE target_id = ? AND role = 'her' ORDER BY created_at DESC LIMIT 1`)
      .get(session.target_id) as any;
    if (!lastHerMsg) { res.status(400).json({ error: '没有对方消息' }); return; }

    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(session.target_id, req.user.userId) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 15').all(session.target_id).reverse();
    const aiMessages = db.prepare('SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10').all(session.id).reverse();

    // SSE headers
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });
    const send = (event: string, data: any) => { if (!clientDisconnected) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} } };
    const heartbeatTimer = setInterval(() => { send('heartbeat', { ts: Date.now() }); }, 2000);

    // ===== Diagnosis-first: ensure diagnosis exists =====
    let diagnosis: any = null;
    if (target.active_diagnosis_id) {
      const d = db.prepare('SELECT * FROM chat_diagnoses WHERE id = ?').get(target.active_diagnosis_id) as any;
      if (d) {
        diagnosis = { ...d, warnings: JSON.parse(d.warnings_json || '[]'), knowledgeIds: JSON.parse(d.knowledge_ids || '[]') };
      }
    }

    if (!diagnosis) {
      send('step', { step: 'auto_diagnosing' });
      try {
        diagnosis = await runDiagnosisInternal(target, recentMessages, provider || 'zhipu');
      } catch (diagErr: any) {
        console.error('[Auto-Diagnose Error]', diagErr.message);
        diagnosis = {
          id: '',
          target_id: target.id,
          attitude_level: '无法判断',
          language_pattern: '无法判断',
          emotion_type: '未知',
          emotion_valence: '中性',
          stage: '信息不足',
          upgrade_ready: false,
          upgrade_reason: '',
          warnings: ['自动诊断暂时不可用，请稍后手动重新诊断'],
          action: '维持当前关系',
          strategy: '先进行轻松对话，积累更多数据后再诊断',
          knowledgeIds: [],
          created_at: Date.now(),
        };
      }
      send('diagnosis_ready', { diagnosis });
      if (diagnosis.action || diagnosis.strategy) {
        send('plan', { goal: diagnosis.action, nextStep: diagnosis.strategy });
      }
    }

    const promptParams = { target, recentMessages: recentMessages as any[], planGoal: session.plan_goal, planNextStep: session.plan_next_step, feedbackPreferences: '', diagnosis };

    const baseMessages = isQuick
      ? buildQuickMessages({ ...promptParams, contextSummary: session.context_summary || '' })
      : buildFullMessagesOptimized(promptParams);
    const conversationMessages: Array<{ role: string; content: string }> = [...baseMessages];
    if (!isQuick) {
      for (const aiMsg of aiMessages as any[]) { conversationMessages.push({ role: aiMsg.role as string, content: aiMsg.content as string }); }
    }
    conversationMessages.push({ role: 'user', content: `对方的最新消息是：${lastHerMsg.text}` });

    if (!isQuick) send('step', { step: 'analyze' });
    send('step', { step: 'generating' });

    let raw = '';
    let sentReplyCount = 0;
    try {
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, isQuick ? 4096 : 8192)) {
        raw += delta;
        if (clientDisconnected) break;
        send('delta', { text: delta });

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

    if (!isQuick) send('step', { step: 'parsing' });

    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[Regen Parse Error] All fallback attempts failed. Raw:', raw.slice(0, 500));
      parsed = SAFE_FALLBACK;
    }

    let quickCtx = '';
    if (isQuick) {
      const normalized = normalizeCompactResponse(parsed);
      quickCtx = normalized.ctx || '';
      parsed = normalized;
    }

    // Send structured events (diagnosis-aware: only replies)
    if (!isQuick) {
      send('replies', parsed.replies || []);
    }

    // Save to DB
    const totalText = conversationMessages.map(m => m.content).join('');
    const estimatedTokens = Math.ceil(Buffer.byteLength(totalText, 'utf-8') / 2);

    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), session.id, 'assistant', JSON.stringify(parsed), roundId, nextVersion, Date.now());

    if (isQuick) {
      db.prepare('UPDATE ai_sessions SET round_count = round_count + 1, context_tokens = ?, context_summary = ?, diagnosis_id = ? WHERE id = ?')
        .run(estimatedTokens, quickCtx || session.context_summary, diagnosis?.id || null, session.id);
    } else {
      db.prepare('UPDATE ai_sessions SET round_count = round_count + 1, context_tokens = ?, diagnosis_id = ? WHERE id = ?')
        .run(estimatedTokens, diagnosis?.id || null, session.id);
    }

    send('done', { contextUsage: { estimatedTokens, maxTokens: 8000, percentage: Math.min(Math.round(estimatedTokens / 8000 * 100), 100) }, roundId, version: nextVersion });
    res.end();
  } catch (err: any) {
    console.error('Regenerate error:', err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || 'AI 服务异常' })}\n\n`);
      res.end();
    } catch { /* connection already closed */ }
  }
});

// ===== Diagnosis API (target-scoped, diagnosis-first architecture) =====

// POST /api/targets/:targetId/diagnose — SSE stream, target-scoped diagnosis
app.post('/api/targets/:targetId/diagnose', async (req: any, res: Response) => {
  try {
    const { provider } = req.body;
    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.targetId, req.user.userId) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 30').all(target.id).reverse();
    if (recentMessages.length < 2) { res.status(400).json({ error: '聊天记录太少，至少需要2条消息才能诊断' }); return; }

    // SSE headers
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });
    const send = (event: string, data: any) => { if (!clientDisconnected) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} } };

    send('step', { step: 'analyzing' });

    const systemPrompt = buildAdvisorPrompt({ target, recentMessages: recentMessages as any[], contextSummary: '' });
    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请分析对方当前的状态' },
    ];

    let raw = '';
    const heartbeatTimer = setInterval(() => { send('heartbeat', { ts: Date.now() }); }, 2000);
    try {
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, 16384)) {
        raw += delta;
        if (clientDisconnected) break;
        send('delta', { text: delta });
      }
    } finally {
      clearInterval(heartbeatTimer);
    }

    send('step', { step: 'parsing' });
    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[Diagnose Parse Error] Full raw output:\n', raw);
      send('debug_raw', { source: 'diagnose', rawLength: raw.length, rawPreview: raw.slice(0, 800) });
      res.write(`event: error\ndata: ${JSON.stringify({ message: '诊断结果解析失败，请重试', rawLength: raw.length, rawPreview: raw.slice(0, 500) })}\n\n`);
      res.end();
      return;
    }

    // Validate: must have attitude or at minimum some structure
    if (!parsed.attitude?.level || !parsed.emotion?.type) {
      console.error('[Diagnose Invalid] LLM returned unexpected structure:', JSON.stringify(parsed).slice(0, 500));
      // Graceful degradation: fill in missing fields with defaults instead of erroring
      parsed = {
        ...parsed,
        attitude: parsed.attitude || {},
        emotion: parsed.emotion || {},
        diagnosis: parsed.diagnosis || {},
        nextStep: parsed.nextStep || {},
      };
      parsed.attitude.level = parsed.attitude.level || '回应';
      parsed.attitude.languagePattern = parsed.attitude.languagePattern || '无法判断';
      parsed.attitude.detail = parsed.attitude.detail || '数据不足以做出准确判断';
      parsed.attitude.evidence = parsed.attitude.evidence || '';
      parsed.emotion.type = parsed.emotion.type || '未知';
      parsed.emotion.valence = parsed.emotion.valence || '中性';
      parsed.emotion.detail = parsed.emotion.detail || '情绪状态不明确';
      parsed.emotion.evidence = parsed.emotion.evidence || '';
      console.log('[Diagnose] Using degraded fallback structure');
    }

    // Save to chat_diagnoses
    const diag = parsed.diagnosis || {};
    const diagId = uuid();
    const now = Date.now();
    db.prepare(`INSERT INTO chat_diagnoses (id, session_id, target_id, attitude_level, language_pattern, emotion_type, emotion_valence, stage, upgrade_ready, upgrade_reason, warnings_json, action, strategy, knowledge_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(diagId, null, target.id,
        parsed.attitude?.level || '', parsed.attitude?.languagePattern || '',
        parsed.emotion?.type || '', parsed.emotion?.valence || '',
        diag.stage || '', diag.upgradeReady ? 1 : 0, diag.upgradeReason || '',
        JSON.stringify(diag.warnings || []),
        parsed.nextStep?.action || '', parsed.nextStep?.strategy || '',
        JSON.stringify(diag.knowledgeIds || []), now);

    // Set as active diagnosis
    db.prepare('UPDATE chat_targets SET active_diagnosis_id = ? WHERE id = ?').run(diagId, target.id);

    // Accumulate warnings
    for (const w of (diag.warnings || [])) {
      let wt = 'other';
      if (/诚意陷阱|诚意/.test(w)) wt = 'sincerity_trap';
      else if (/真命天女|迷恋/.test(w)) wt = 'oneitis';
      else if (/因果链|放大/.test(w)) wt = 'causal_chain';
      else if (/越级|操之过急/.test(w)) wt = 'over_escalation';
      else if (/需求感|暴露/.test(w)) wt = 'neediness';
      const existing = db.prepare('SELECT id, count FROM user_warnings WHERE user_id = ? AND target_id = ? AND warning_type = ?').get(req.user.userId, target.id, wt) as any;
      if (existing) {
        db.prepare('UPDATE user_warnings SET count = count + 1, detail = ?, updated_at = ? WHERE id = ?').run(w, now, existing.id);
      } else {
        db.prepare('INSERT INTO user_warnings (id, user_id, target_id, warning_type, detail, count, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(uuid(), req.user.userId, target.id, wt, w, now);
      }
    }

    const diagnosis = {
      id: diagId, target_id: target.id,
      attitude_level: parsed.attitude?.level || '',
      language_pattern: parsed.attitude?.languagePattern || '',
      emotion_type: parsed.emotion?.type || '',
      emotion_valence: parsed.emotion?.valence || '',
      stage: diag.stage || '',
      upgrade_ready: !!diag.upgradeReady,
      upgrade_reason: diag.upgradeReason || '',
      warnings: diag.warnings || [],
      action: parsed.nextStep?.action || '',
      strategy: parsed.nextStep?.strategy || '',
      knowledgeIds: diag.knowledgeIds || [],
      created_at: now,
    };

    send('diagnosis_done', { diagnosis });
    res.end();
  } catch (err: any) {
    console.error('Diagnose error:', err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || '诊断服务异常' })}\n\n`);
      res.end();
    } catch { /* connection already closed */ }
  }
});

// GET /api/targets/:targetId/active-diagnosis
app.get('/api/targets/:targetId/active-diagnosis', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.targetId, req.user.userId) as any;
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

  if (!target.active_diagnosis_id) { res.json({ diagnosis: null }); return; }

  const d = db.prepare('SELECT * FROM chat_diagnoses WHERE id = ?').get(target.active_diagnosis_id) as any;
  if (!d) { res.json({ diagnosis: null }); return; }

  res.json({
    diagnosis: {
      id: d.id, target_id: d.target_id,
      attitude_level: d.attitude_level,
      language_pattern: d.language_pattern,
      emotion_type: d.emotion_type,
      emotion_valence: d.emotion_valence,
      stage: d.stage,
      upgrade_ready: !!d.upgrade_ready,
      upgrade_reason: d.upgrade_reason,
      warnings: JSON.parse(d.warnings_json || '[]'),
      action: d.action,
      strategy: d.strategy,
      knowledgeIds: JSON.parse(d.knowledge_ids || '[]'),
      created_at: d.created_at,
    },
  });
});

// DELETE /api/targets/:targetId/active-diagnosis
app.delete('/api/targets/:targetId/active-diagnosis', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ? AND user_id = ?').get(req.params.targetId, req.user.userId) as any;
  if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  db.prepare('UPDATE chat_targets SET active_diagnosis_id = NULL WHERE id = ?').run(target.id);
  res.json({ success: true });
});

// ===== Internal helper: run diagnosis (non-SSE, used by generate/regenerate) =====

async function runDiagnosisInternal(target: any, recentMessages: any[], provider: string): Promise<any> {
  const systemPrompt = buildAdvisorPrompt({ target, recentMessages, contextSummary: '' });
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请分析对方当前的状态' },
  ];

  const raw = await chatCompletion(messages, provider, 16384);
  let parsed = parseJsonSafely(raw);
  if (!parsed) {
    console.error('[Auto-Diagnose Parse Error] Full raw output:\n', raw);
    throw new Error('自动诊断解析失败');
  }

  // Validate: must have attitude or at minimum some structure
  if (!parsed.attitude?.level || !parsed.emotion?.type) {
    console.error('[Auto-Diagnose Invalid] Unexpected structure:', JSON.stringify(parsed).slice(0, 500));
    // Graceful degradation instead of throwing
    parsed = {
      ...parsed,
      attitude: parsed.attitude || {},
      emotion: parsed.emotion || {},
      diagnosis: parsed.diagnosis || {},
      nextStep: parsed.nextStep || {},
    };
    parsed.attitude.level = parsed.attitude.level || '回应';
    parsed.attitude.languagePattern = parsed.attitude.languagePattern || '无法判断';
    parsed.attitude.detail = parsed.attitude.detail || '数据不足以做出准确判断';
    parsed.attitude.evidence = parsed.attitude.evidence || '';
    parsed.emotion.type = parsed.emotion.type || '未知';
    parsed.emotion.valence = parsed.emotion.valence || '中性';
    parsed.emotion.detail = parsed.emotion.detail || '情绪状态不明确';
    parsed.emotion.evidence = parsed.emotion.evidence || '';
    console.log('[Auto-Diagnose] Using degraded fallback structure');
  }

  const diag = parsed.diagnosis || {};
  const diagId = uuid();
  const now = Date.now();

  db.prepare(`INSERT INTO chat_diagnoses (id, session_id, target_id, attitude_level, language_pattern, emotion_type, emotion_valence, stage, upgrade_ready, upgrade_reason, warnings_json, action, strategy, knowledge_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(diagId, '', target.id,
      parsed.attitude?.level || '', parsed.attitude?.languagePattern || '',
      parsed.emotion?.type || '', parsed.emotion?.valence || '',
      diag.stage || '', diag.upgradeReady ? 1 : 0, diag.upgradeReason || '',
      JSON.stringify(diag.warnings || []),
      parsed.nextStep?.action || '', parsed.nextStep?.strategy || '',
      JSON.stringify(diag.knowledgeIds || []), now);

  db.prepare('UPDATE chat_targets SET active_diagnosis_id = ? WHERE id = ?').run(diagId, target.id);

  // Accumulate warnings
  for (const w of (diag.warnings || [])) {
    let wt = 'other';
    if (/诚意陷阱|诚意/.test(w)) wt = 'sincerity_trap';
    else if (/真命天女|迷恋/.test(w)) wt = 'oneitis';
    else if (/因果链|放大/.test(w)) wt = 'causal_chain';
    else if (/越级|操之过急/.test(w)) wt = 'over_escalation';
    else if (/需求感|暴露/.test(w)) wt = 'neediness';
    const existing = db.prepare('SELECT id, count FROM user_warnings WHERE user_id = ? AND target_id = ? AND warning_type = ?').get(target.user_id, target.id, wt) as any;
    if (existing) {
      db.prepare('UPDATE user_warnings SET count = count + 1, detail = ?, updated_at = ? WHERE id = ?').run(w, now, existing.id);
    } else {
      db.prepare('INSERT INTO user_warnings (id, user_id, target_id, warning_type, detail, count, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(uuid(), target.user_id, target.id, wt, w, now);
    }
  }

  return {
    id: diagId, target_id: target.id,
    attitude_level: parsed.attitude?.level || '',
    language_pattern: parsed.attitude?.languagePattern || '',
    emotion_type: parsed.emotion?.type || '',
    emotion_valence: parsed.emotion?.valence || '',
    stage: diag.stage || '',
    upgrade_ready: !!diag.upgradeReady,
    upgrade_reason: diag.upgradeReason || '',
    warnings: diag.warnings || [],
    action: parsed.nextStep?.action || '',
    strategy: parsed.nextStep?.strategy || '',
    knowledgeIds: diag.knowledgeIds || [],
    created_at: now,
  };
}

// ===== Advisor Analysis & Review Summary =====
app.post('/api/sessions/:sessionId/analyze', async (req: any, res: Response) => {
  try {
    const { mode, provider } = req.body;
    if (mode !== 'advisor' && mode !== 'review') { res.status(400).json({ error: '无效的分析模式' }); return; }

    const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
    if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

    const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(session.target_id) as any;
    if (!target) { res.status(404).json({ error: '聊天对象不存在' }); return; }

    const recentMessages = db.prepare('SELECT * FROM chat_messages WHERE target_id = ? ORDER BY created_at DESC LIMIT 30').all(target.id).reverse();
    if (recentMessages.length < 2) { res.status(400).json({ error: '聊天记录太少，至少需要2条消息才能分析' }); return; }

    // SSE headers
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });
    const send = (event: string, data: any) => { if (!clientDisconnected) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} } };

    send('step', { step: 'analyzing' });

    // Build prompt based on mode
    let systemPrompt: string;
    if (mode === 'advisor') {
      systemPrompt = buildAdvisorPrompt({ target, recentMessages: recentMessages as any[], contextSummary: session.context_summary || '' });
    } else {
      const selections = db.prepare('SELECT reply_text, strategy FROM reply_selections WHERE session_id = ? ORDER BY created_at ASC').all(session.id) as any[];
      systemPrompt = buildReviewPrompt({ target, recentMessages: recentMessages as any[], replySelections: selections || [] });
    }

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: mode === 'advisor' ? '请分析对方当前的状态' : '请复盘我的聊天表现' },
    ];

    // Stream LLM response
    let raw = '';
    const heartbeatTimer = setInterval(() => { send('heartbeat', { ts: Date.now() }); }, 2000);
    try {
      for await (const delta of chatCompletionStream(conversationMessages, provider || 'zhipu', 1, 16384)) {
        raw += delta;
        if (clientDisconnected) break;
        send('delta', { text: delta });
      }
    } finally {
      clearInterval(heartbeatTimer);
    }

    // Parse response
    send('step', { step: 'parsing' });
    let parsed = parseJsonSafely(raw);
    if (!parsed) {
      console.error('[Analyze Parse Error] Full raw output:\n', raw);
      send('debug_raw', { source: mode, rawLength: raw.length, rawPreview: raw.slice(0, 800) });
      // Create fallback response based on mode instead of erroring
      if (mode === 'advisor') {
        parsed = {
          attitude: { level: '无法判断', languagePattern: '解析异常', detail: 'AI 返回格式异常，建议重试', evidence: '' },
          emotion: { type: '未知', valence: '中性', detail: '无法识别', evidence: '' },
          thought: { intention: '数据不足（低）', expectation: '无法判断', detail: '本次分析结果未能解析，请重新分析' },
          diagnosis: { warnings: ['解析失败，请重试'], stage: '信息不足', upgradeReady: false, upgradeReason: '', knowledgeIds: [] },
          nextStep: { action: '建议重新分析', strategy: '重试', keyPoints: [], warnings: ['请重试'] },
        };
      } else {
        parsed = {
          highlights: [],
          mistakes: [],
          scores: { signalRecognition: 3, strategySelection: 3, rhythmControl: 3, emotionManagement: 3, responseQuality: 3 },
          overall: { total: 60, summary: 'AI 返回格式异常，分数为降级默认值，建议重新复盘', strengths: [], weaknesses: ['解析失败'], advice: '请重新点击复盘', warningLevel: 'yellow', knowledgeGaps: [] },
        };
      }
    }

    // Save to ai_messages
    const aiMsgId = uuid();
    db.prepare('INSERT INTO ai_messages (id, session_id, role, content, round_id, version, msg_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(aiMsgId, session.id, 'assistant', JSON.stringify(parsed), null, 1, mode, Date.now());

    // ===== 自动存储到评估/诊断/警告表 =====
    if (mode === 'advisor' && parsed.diagnosis) {
      const diag = parsed.diagnosis;
      db.prepare(`INSERT INTO chat_diagnoses (id, session_id, target_id, attitude_level, language_pattern, emotion_type, emotion_valence, stage, upgrade_ready, upgrade_reason, warnings_json, action, strategy, knowledge_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuid(), session.id, target.id,
          parsed.attitude?.level || '', parsed.attitude?.languagePattern || '',
          parsed.emotion?.type || '', parsed.emotion?.valence || '',
          diag.stage || '', diag.upgradeReady ? 1 : 0, diag.upgradeReason || '',
          JSON.stringify(diag.warnings || []),
          parsed.nextStep?.action || '', parsed.nextStep?.strategy || '',
          JSON.stringify(diag.knowledgeIds || []), Date.now());
      // 累积警告
      for (const w of (diag.warnings || [])) {
        let wt = 'other';
        if (/诚意陷阱|诚意/.test(w)) wt = 'sincerity_trap';
        else if (/真命天女|迷恋/.test(w)) wt = 'oneitis';
        else if (/因果链|放大/.test(w)) wt = 'causal_chain';
        else if (/越级|操之过急/.test(w)) wt = 'over_escalation';
        else if (/需求感|暴露/.test(w)) wt = 'neediness';
        const existing = db.prepare('SELECT id, count FROM user_warnings WHERE user_id = ? AND target_id = ? AND warning_type = ?').get(req.user.userId, target.id, wt) as any;
        if (existing) {
          db.prepare('UPDATE user_warnings SET count = count + 1, detail = ?, updated_at = ? WHERE id = ?').run(w, Date.now(), existing.id);
        } else {
          db.prepare('INSERT INTO user_warnings (id, user_id, target_id, warning_type, detail, count, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(uuid(), req.user.userId, target.id, wt, w, Date.now());
        }
      }
    }
    if (mode === 'review' && parsed.scores) {
      const ov = parsed.overall || {};
      db.prepare(`INSERT INTO chat_evaluations (id, session_id, target_id, scores_json, total_score, warning_level, highlights_json, mistakes_json, strengths, weaknesses, advice, knowledge_gaps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuid(), session.id, target.id,
          JSON.stringify(parsed.scores), ov.total || 0, ov.warningLevel || 'green',
          JSON.stringify(parsed.highlights || []), JSON.stringify(parsed.mistakes || []),
          JSON.stringify(ov.strengths || []), JSON.stringify(ov.weaknesses || []),
          ov.advice || '', JSON.stringify(ov.knowledgeGaps || []), Date.now());
    }

    send('analysis_done', { result: parsed, aiMessageId: aiMsgId });
    res.end();
  } catch (err: any) {
    console.error('Analyze error:', err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || '分析服务异常' })}\n\n`);
      res.end();
    } catch {}
  }
});

// ===== Get Analysis History by Target =====
app.get('/api/targets/:targetId/analyses', (req: any, res: Response) => {
  const { type } = req.query;
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.targetId) as any;
  if (!target || target.user_id !== req.user.userId) { res.status(404).json({ error: '聊天对象不存在' }); return; }

  const sessionIds = db.prepare('SELECT id FROM ai_sessions WHERE target_id = ?').all(req.params.targetId).map((s: any) => s.id);
  if (sessionIds.length === 0) { res.json([]); return; }

  const placeholders = sessionIds.map(() => '?').join(',');
  let query = `SELECT id, msg_type, content, created_at FROM ai_messages WHERE session_id IN (${placeholders}) AND msg_type IN ('advisor', 'review')`;
  const params: any[] = [...sessionIds];
  if (type === 'advisor' || type === 'review') {
    query += ' AND msg_type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC LIMIT 50';
  res.json(db.prepare(query).all(...params));
});

// ===== 评估记录查询 =====
app.get('/api/targets/:targetId/evaluations', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.targetId) as any;
  if (!target || target.user_id !== req.user.userId) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const rows = db.prepare('SELECT * FROM chat_evaluations WHERE target_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.targetId) as any[];
  res.json(rows.map(e => ({
    ...e, scores: JSON.parse(e.scores_json), highlights: JSON.parse(e.highlights_json),
    mistakes: JSON.parse(e.mistakes_json), strengths: JSON.parse(e.strengths),
    weaknesses: JSON.parse(e.weaknesses), knowledgeGaps: JSON.parse(e.knowledge_gaps),
    scores_json: undefined, highlights_json: undefined, mistakes_json: undefined, knowledge_gaps: undefined,
  })));
});

// ===== 诊断记录查询 =====
app.get('/api/targets/:targetId/diagnoses', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.targetId) as any;
  if (!target || target.user_id !== req.user.userId) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  const rows = db.prepare('SELECT * FROM chat_diagnoses WHERE target_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.targetId) as any[];
  res.json(rows.map(d => ({
    ...d, warnings: JSON.parse(d.warnings_json), knowledgeIds: JSON.parse(d.knowledge_ids),
    warnings_json: undefined, knowledge_ids: undefined,
  })));
});

// ===== 累积警告查询 =====
app.get('/api/targets/:targetId/warnings', (req: any, res: Response) => {
  const target = db.prepare('SELECT * FROM chat_targets WHERE id = ?').get(req.params.targetId) as any;
  if (!target || target.user_id !== req.user.userId) { res.status(404).json({ error: '聊天对象不存在' }); return; }
  res.json(db.prepare('SELECT * FROM user_warnings WHERE user_id = ? AND target_id = ? ORDER BY updated_at DESC').all(req.user.userId, req.params.targetId));
});

app.post('/api/sessions/:sessionId/feedback', (req: any, res: Response) => {
  const { replyId, rating } = req.body;
  const session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(req.params.sessionId) as any;
  if (!session || !verifyTargetOwnership(session.target_id, req.user.userId)) { res.status(404).json({ error: '辅导窗口不存在' }); return; }

  db.prepare('INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), req.params.sessionId, 'user', JSON.stringify({ type: 'feedback', replyId, rating }), Date.now());
  res.json({ success: true });
});

// ===== Admin Middleware =====
function adminMiddleware(req: any, res: Response, next: any) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId) as any;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}

// ===== Admin API Routes =====

// Check if current user is admin
app.get('/api/admin/me', authMiddleware, (req: any, res: Response) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId) as any;
  res.json({ isAdmin: user?.role === 'admin' });
});

// System statistics
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (_req: any, res: Response) => {
  const users = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  const targets = (db.prepare('SELECT COUNT(*) as count FROM chat_targets').get() as any).count;
  const messages = (db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as any).count;
  const sessions = (db.prepare('SELECT COUNT(*) as count FROM ai_sessions').get() as any).count;
  const diagnoses = (db.prepare('SELECT COUNT(*) as count FROM chat_diagnoses').get() as any).count;
  const evaluations = (db.prepare('SELECT COUNT(*) as count FROM chat_evaluations').get() as any).count;

  // Recent activity (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentMessages = (db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE created_at > ?').get(oneDayAgo) as any).count;
  const recentSessions = (db.prepare('SELECT COUNT(*) as count FROM ai_sessions WHERE created_at > ?').get(oneDayAgo) as any).count;

  // Database file size
  let dbSizeKB = 0;
  try {
    const fsSync = require('fs');
    const pathSync = require('path');
    const stat = fsSync.statSync(pathSync.join(process.cwd(), 'data', 'chat-trainer.db'));
    dbSizeKB = Math.round(stat.size / 1024);
  } catch {}

  res.json({
    users, targets, messages, sessions, diagnoses, evaluations,
    recentMessages, recentSessions, dbSizeKB,
  });
});

// List all users with usage stats
app.get('/api/admin/users', authMiddleware, adminMiddleware, (_req: any, res: Response) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all() as any[];
  const usersWithStats = users.map(u => {
    const targetCount = (db.prepare('SELECT COUNT(*) as count FROM chat_targets WHERE user_id = ?').get(u.id) as any).count;
    const messageCount = (db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE target_id IN (SELECT id FROM chat_targets WHERE user_id = ?)').get(u.id) as any).count;
    const sessionCount = (db.prepare('SELECT COUNT(*) as count FROM ai_sessions WHERE target_id IN (SELECT id FROM chat_targets WHERE user_id = ?)').get(u.id) as any).count;
    return { ...u, targetCount, messageCount, sessionCount };
  });
  res.json(usersWithStats);
});

// Delete a user and all their data
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req: any, res: Response) => {
  const userId = req.params.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) { res.status(404).json({ error: '用户不存在' }); return; }
  if (user.role === 'admin') { res.status(400).json({ error: '不能删除管理员账户' }); return; }

  db.transaction(() => {
    const targetIds = db.prepare('SELECT id FROM chat_targets WHERE user_id = ?').all(userId).map((t: any) => t.id);
    for (const targetId of targetIds) {
      const sessionIds = db.prepare('SELECT id FROM ai_sessions WHERE target_id = ?').all(targetId).map((s: any) => s.id);
      for (const sessionId of sessionIds) {
        db.prepare('DELETE FROM ai_messages WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM reply_selections WHERE session_id = ?').run(sessionId);
      }
      db.prepare('DELETE FROM ai_sessions WHERE target_id = ?').run(targetId);
      db.prepare('DELETE FROM chat_messages WHERE target_id = ?').run(targetId);
      db.prepare('DELETE FROM chat_diagnoses WHERE target_id = ?').run(targetId);
      db.prepare('DELETE FROM chat_evaluations WHERE target_id = ?').run(targetId);
      db.prepare('DELETE FROM user_warnings WHERE target_id = ?').run(targetId);
    }
    db.prepare('DELETE FROM chat_targets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  })();
  res.json({ success: true });
});

// Change user role
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req: any, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) { res.status(400).json({ error: '无效角色' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) { res.status(404).json({ error: '用户不存在' }); return; }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// Get system settings
app.get('/api/admin/settings', authMiddleware, adminMiddleware, (_req: any, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// Update system settings
app.put('/api/admin/settings', authMiddleware, adminMiddleware, (req: any, res: Response) => {
  const allowedKeys = ['allow_registration', 'max_targets_per_user', 'max_sessions_per_target'];
  for (const [key, value] of Object.entries(req.body)) {
    if (allowedKeys.includes(key)) {
      db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, String(value), Date.now());
    }
  }
  res.json({ success: true });
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
