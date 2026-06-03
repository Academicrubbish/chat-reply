import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase, SqlValue } from 'sql.js';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat-trainer.db');

let db: SqlJsDatabase;
let inTransaction = false;

function saveDb() {
  if (inTransaction) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function runStatement(sql: string, params?: SqlValue[]) {
  try {
    if (params && params.length > 0) {
      db.run(sql, params);
    } else {
      db.run(sql);
    }
    saveDb();
  } catch (e: any) {
    if (!sql.startsWith('CREATE') && !sql.startsWith('CREATE INDEX')) {
      throw e;
    }
  }
}

export interface Stmt {
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

function bindParams(stmt: ReturnType<SqlJsDatabase['prepare']>, params: unknown[]) {
  if (params.length > 0) stmt.bind(params as SqlValue[]);
}

function prepareStmt(sql: string): Stmt {
  return {
    run(...params: unknown[]) {
      const stmt = db.prepare(sql);
      bindParams(stmt, params);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        stmt.step();
      } else {
        stmt.step();
      }
      const changes = db.getRowsModified();
      stmt.free();
      saveDb();
      return { lastInsertRowid: 0, changes };
    },
    get(...params: unknown[]) {
      const stmt = db.prepare(sql);
      bindParams(stmt, params);
      const hasRow = stmt.step();
      let result: Record<string, unknown> | undefined;
      if (hasRow) {
        result = stmt.getAsObject() as Record<string, unknown>;
      }
      stmt.free();
      return result;
    },
    all(...params: unknown[]) {
      const stmt = db.prepare(sql);
      bindParams(stmt, params);
      const results: Record<string, unknown>[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as Record<string, unknown>);
      }
      stmt.free();
      return results;
    },
  };
}

type TransactionFn = (...args: any[]) => any;

export interface DbWrapper {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  pragma(pragma: string): void;
  transaction<T extends TransactionFn>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
}

const dbWrapper: DbWrapper = {
  prepare(sql: string) {
    return prepareStmt(sql);
  },
  exec(sql: string) {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      runStatement(stmt);
    }
    saveDb();
  },
  pragma(pragma: string) {
    db.run(`PRAGMA ${pragma}`);
    saveDb();
  },
  transaction<T extends TransactionFn>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>) => {
      inTransaction = true;
      db.run('BEGIN');
      try {
        const result = fn(...args);
        db.run('COMMIT');
        inTransaction = false;
        saveDb();
        return result;
      } catch (e) {
        try { db.run('ROLLBACK'); } catch {}
        inTransaction = false;
        saveDb();
        throw e;
      }
    };
  },
};

export interface ChatMessage {
  id: string;
  target_id: string;
  role: string;
  text: string;
  source: string;
  strategy: string | null;
  session_id: string | null;
  created_at: number;
}

const initSqlJsModule = initSqlJs();

let dbBuffer: Buffer | undefined;
if (fs.existsSync(dbPath)) {
  dbBuffer = fs.readFileSync(dbPath);
}

let dbReady = false;

export async function initDb(): Promise<void> {
  if (dbReady) return;
  const SQL = await initSqlJsModule;
  if (dbBuffer) {
    db = new SQL.Database(dbBuffer);
  } else {
    db = new SQL.Database();
  }

  dbWrapper.pragma('journal_mode = WAL');
  dbWrapper.pragma('foreign_keys = ON');

  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS chat_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      meet_scene TEXT DEFAULT '',
      persona TEXT DEFAULT '',
      hobbies TEXT DEFAULT '',
      recent_chats TEXT DEFAULT '',
      tone_level TEXT DEFAULT 'moderate',
      goal_intent TEXT DEFAULT 'pursuing',
      forbidden_topics TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );


    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      strategy TEXT DEFAULT NULL,
      session_id TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (target_id) REFERENCES chat_targets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_target ON chat_messages(target_id, created_at);

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      round_count INTEGER DEFAULT 0,
      context_tokens INTEGER DEFAULT 0,
      plan_goal TEXT DEFAULT '',
      plan_next_step TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (target_id) REFERENCES chat_targets(id)
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      round_id TEXT DEFAULT NULL,
      version INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_round ON ai_messages(session_id, round_id, version);

    CREATE TABLE IF NOT EXISTS reply_selections (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      ai_message_id TEXT NOT NULL,
      reply_id INTEGER NOT NULL,
      reply_text TEXT NOT NULL,
      strategy TEXT,
      chat_message_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id),
      FOREIGN KEY (ai_message_id) REFERENCES ai_messages(id),
      FOREIGN KEY (chat_message_id) REFERENCES chat_messages(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reply_selections_session ON reply_selections(session_id);
    CREATE INDEX IF NOT EXISTS idx_reply_selections_ai_msg ON reply_selections(ai_message_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate existing databases: add user_id to chat_targets if missing
  try {
    dbWrapper.exec(`ALTER TABLE chat_targets ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
  } catch {}

  // Migrate: add round_id and version to ai_messages if missing
  try {
    dbWrapper.exec(`ALTER TABLE ai_messages ADD COLUMN round_id TEXT DEFAULT NULL`);
  } catch {}
  try {
    dbWrapper.exec(`ALTER TABLE ai_messages ADD COLUMN version INTEGER DEFAULT 1`);
  } catch {}

  // Migrate: add context_summary to ai_sessions if missing
  try {
    dbWrapper.exec(`ALTER TABLE ai_sessions ADD COLUMN context_summary TEXT DEFAULT ''`);
  } catch {}

  // Migrate: add msg_type to ai_messages for advisor/review analysis
  try {
    dbWrapper.exec(`ALTER TABLE ai_messages ADD COLUMN msg_type TEXT DEFAULT 'reply'`);
  } catch {}
  try {
    dbWrapper.exec(`CREATE INDEX IF NOT EXISTS idx_ai_messages_type ON ai_messages(session_id, msg_type)`);
  } catch {}

  // ===== 新增：评估/诊断/警告表 =====

  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS chat_evaluations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      warning_level TEXT NOT NULL DEFAULT 'green',
      highlights_json TEXT NOT NULL,
      mistakes_json TEXT NOT NULL,
      strengths TEXT DEFAULT '',
      weaknesses TEXT DEFAULT '',
      advice TEXT DEFAULT '',
      knowledge_gaps TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id),
      FOREIGN KEY (target_id) REFERENCES chat_targets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_session ON chat_evaluations(session_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_target ON chat_evaluations(target_id, created_at);

    CREATE TABLE IF NOT EXISTS chat_diagnoses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      attitude_level TEXT NOT NULL,
      language_pattern TEXT DEFAULT '',
      emotion_type TEXT DEFAULT '',
      emotion_valence TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      upgrade_ready INTEGER DEFAULT 0,
      upgrade_reason TEXT DEFAULT '',
      warnings_json TEXT DEFAULT '[]',
      action TEXT DEFAULT '',
      strategy TEXT DEFAULT '',
      knowledge_ids TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id),
      FOREIGN KEY (target_id) REFERENCES chat_targets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_diagnoses_session ON chat_diagnoses(session_id);
    CREATE INDEX IF NOT EXISTS idx_diagnoses_target ON chat_diagnoses(target_id, created_at);

    CREATE TABLE IF NOT EXISTS user_warnings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      warning_type TEXT NOT NULL,
      detail TEXT DEFAULT '',
      count INTEGER DEFAULT 1,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (target_id) REFERENCES chat_targets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_warnings_user_target ON user_warnings(user_id, target_id, warning_type);
  `);

  // Migrate: add active_diagnosis_id to chat_targets (diagnosis-first architecture)
  try {
    dbWrapper.exec(`ALTER TABLE chat_targets ADD COLUMN active_diagnosis_id TEXT DEFAULT NULL`);
  } catch {}

  // Migrate: add diagnosis_id to ai_sessions (track which diagnosis was used)
  try {
    dbWrapper.exec(`ALTER TABLE ai_sessions ADD COLUMN diagnosis_id TEXT DEFAULT NULL`);
  } catch {}

  // One-time: auto-activate the latest diagnosis for existing targets
  try {
    dbWrapper.exec(`
      UPDATE chat_targets SET active_diagnosis_id = (
        SELECT id FROM chat_diagnoses
        WHERE chat_diagnoses.target_id = chat_targets.id
        ORDER BY created_at DESC LIMIT 1
      ) WHERE active_diagnosis_id IS NULL
        AND EXISTS (SELECT 1 FROM chat_diagnoses WHERE chat_diagnoses.target_id = chat_targets.id)
    `);
  } catch {}

  dbReady = true;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export default dbWrapper;
