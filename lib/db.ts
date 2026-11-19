import { createClient, type Client, type InArgs, type Transaction } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";

/**
 * Storage. Locally this is a SQLite file in data/ (no setup needed).
 * On Vercel set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN and the same SQL runs on Turso.
 */
const REMOTE = process.env.TURSO_DATABASE_URL;
const LOCAL = process.env.MLYFO_DB ?? path.join(process.cwd(), "data", "mlyfo.db");

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
CREATE TABLE IF NOT EXISTS address_requests (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_by INTEGER REFERENCES users(id),
  fulfilled_at TEXT
);
`;

const MIGRATIONS = [
  "ALTER TABLE contacts ADD COLUMN source TEXT NOT NULL DEFAULT 'saved'", // saved | mlyfo | confirmed
  "ALTER TABLE contacts ADD COLUMN created_at TEXT",
  "ALTER TABLE users ADD COLUMN address_changed_at TEXT",
];

type Row = Record<string, unknown>;
export type Q = {
  get<T = Row>(sql: string, ...args: unknown[]): Promise<T | undefined>;
  all<T = Row>(sql: string, ...args: unknown[]): Promise<T[]>;
  run(sql: string, ...args: unknown[]): Promise<{ lastInsertRowid: number; changes: number }>;
};

type G = typeof globalThis & { __mlyfo?: Promise<Client> };
const g = globalThis as G;

async function open(): Promise<Client> {
  let c: Client;
  if (REMOTE) {
    c = createClient({ url: REMOTE, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
    c = createClient({ url: "file:" + LOCAL });
    await c.execute("PRAGMA journal_mode = WAL");
    await c.execute("PRAGMA busy_timeout = 5000");
  }
  await c.execute("PRAGMA foreign_keys = ON");
  await c.executeMultiple(SCHEMA);
  // Columns added after launch. ADD COLUMN fails when the column exists, which is the expected case.
  for (const m of MIGRATIONS) { try { await c.execute(m); } catch (e) { if (!/duplicate column/i.test(String(e))) throw e; } }
  const n = Number((await c.execute("SELECT COUNT(*) AS n FROM users")).rows[0].n);
  if (n === 0) {
    try { await c.batch(seed(), "write"); }
    catch (e) { if (!String(e).includes("UNIQUE")) throw e; } // another instance seeded first
  }
  return c;
}

export function client(): Promise<Client> {
  if (!g.__mlyfo) g.__mlyfo = open().catch((e) => { g.__mlyfo = undefined; throw e; });
  return g.__mlyfo;
}

const plain = (cols: string[], r: Row): Row => Object.fromEntries(cols.map((c) => [c, r[c]]));
const norm = (args: unknown[]) => args.map((a) => (a === undefined ? null : typeof a === "boolean" ? Number(a) : a)) as InArgs;

function wrap(exec: (sql: string, args: InArgs) => Promise<{ rows: Row[]; columns: string[]; lastInsertRowid?: bigint; rowsAffected: number }>): Q {
  return {
    async get(sql, ...args) { const r = await exec(sql, norm(args)); return r.rows[0] ? (plain(r.columns, r.rows[0]) as never) : undefined; },
    async all(sql, ...args) { const r = await exec(sql, norm(args)); return r.rows.map((x) => plain(r.columns, x)) as never; },
    async run(sql, ...args) { const r = await exec(sql, norm(args)); return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected }; },
  };
}

/** Run one query outside a transaction. */
export const q: Q = wrap(async (sql, args) => (await client()).execute({ sql, args }) as never);

/** Run several queries atomically. Everything inside must use the given `t`. */
export async function tx<T>(fn: (t: Q) => Promise<T>): Promise<T> {
  const t: Transaction = await (await client()).transaction("write");
  try {
    const r = await fn(wrap((sql, args) => t.execute({ sql, args }) as never));
    await t.commit();
    return r;
  } finally {
    t.close();
  }
}
