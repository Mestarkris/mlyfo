import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";

const DB_PATH = process.env.MLYFO_DB ?? path.join(process.cwd(), "data", "mlyfo.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 50000,
  daily_limit_cents INTEGER NOT NULL DEFAULT 20000,
  per_payment_cents INTEGER NOT NULL DEFAULT 10000,
  new_recipient_cents INTEGER NOT NULL DEFAULT 2500,
  shield_lookalike INTEGER NOT NULL DEFAULT 1,
  shield_scamlist INTEGER NOT NULL DEFAULT 1,
  shield_links INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🙂',
  UNIQUE(user_id, address)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  from_user INTEGER NOT NULL REFERENCES users(id),
  to_address TEXT NOT NULL,
  to_user INTEGER REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,               -- sent | needs_confirmation | blocked | cancelled
  reason TEXT NOT NULL DEFAULT '',
  split_share_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS splits (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS split_shares (
  id INTEGER PRIMARY KEY,
  split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_owner INTEGER NOT NULL DEFAULT 0,
  paid_by INTEGER REFERENCES users(id),
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS link_scans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  verdict TEXT NOT NULL,              -- safe | risky | dangerous | unknown
  reasons TEXT NOT NULL,              -- JSON array
  source TEXT NOT NULL,               -- rules | kane
  kane_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

type G = typeof globalThis & { __mlyfoDb?: DatabaseSync };
const g = globalThis as G;

export function db(): DatabaseSync {
  if (g.__mlyfoDb) return g.__mlyfoDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const d = new DatabaseSync(DB_PATH);
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA);
  const { n } = d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) seed(d);
  g.__mlyfoDb = d;
  return d;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
