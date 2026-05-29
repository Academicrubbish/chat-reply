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
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at);

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

  dbReady = true;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export default dbWrapper;
