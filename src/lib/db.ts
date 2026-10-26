import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Eine SQLite-Datei pro Instanz. Für die Beta auf einem Schweizer Server ausreichend;
// bei Wachstum auf PostgreSQL wechseln (Schema ist bewusst portabel gehalten).

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  zip_city TEXT NOT NULL DEFAULT '',
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT '',
  customer_number TEXT NOT NULL DEFAULT '',
  monthly_price REAL NOT NULL,
  start_date TEXT,
  min_term_months INTEGER NOT NULL DEFAULT 0,
  renewal_months INTEGER NOT NULL DEFAULT 0,
  notice_months INTEGER NOT NULL DEFAULT 1,
  to_month_end INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aktiv',
  ended_on TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contracts_user ON contracts(user_id);
CREATE TABLE IF NOT EXISTS switches (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  offer_id TEXT NOT NULL,
  new_provider TEXT NOT NULL,
  expected_bonus REAL NOT NULL DEFAULT 0,
  expected_by TEXT,
  status TEXT NOT NULL DEFAULT 'erwartet',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS switches_user ON switches(user_id);
`;

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!db) {
    const file = process.env.ABO_DB_PATH ?? path.join(process.cwd(), 'data', 'abo-pilot.db');
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
  }
  return db;
}

export function nowISO(): string {
  return new Date().toISOString();
}
