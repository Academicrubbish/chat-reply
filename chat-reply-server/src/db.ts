import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat-trainer.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_targets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    meet_scene TEXT DEFAULT '',
    persona TEXT DEFAULT '',
    hobbies TEXT DEFAULT '',
    recent_chats TEXT DEFAULT '',
    tone_level TEXT DEFAULT 'moderate',
    goal_intent TEXT DEFAULT 'pursuing',
    forbidden_topics TEXT DEFAULT '',
    created_at INTEGER NOT NULL
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
`);

export default db;
