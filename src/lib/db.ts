import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SEED_OFFERS } from '@/data/offers.seed';
import { SEED_SOURCES } from '@/data/sources.seed';

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
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  monthly_price REAL NOT NULL,
  promo_price REAL,
  promo_months INTEGER NOT NULL DEFAULT 0,
  bonus_chf REAL NOT NULL DEFAULT 0,
  one_time_fee_chf REAL NOT NULL DEFAULT 0,
  new_customer_lock_months INTEGER NOT NULL DEFAULT 0,
  commission_chf REAL NOT NULL DEFAULT 0,
  data_gb REAL,
  roaming_eu INTEGER NOT NULL DEFAULT 0,
  speed_mbps INTEGER,
  includes_tv INTEGER NOT NULL DEFAULT 0,
  min_term_months INTEGER NOT NULL DEFAULT 0,
  valid_until TEXT,
  source_url TEXT NOT NULL,
  checked_at TEXT,
  status TEXT NOT NULL DEFAULT 'entwurf',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  household_size INTEGER NOT NULL DEFAULT 1,
  plz TEXT NOT NULL DEFAULT '',
  mobile_lines INTEGER NOT NULL DEFAULT 1,
  mobile_usage TEXT NOT NULL DEFAULT 'normal',
  roaming TEXT NOT NULL DEFAULT 'europa',
  internet_need TEXT NOT NULL DEFAULT 'schnell',
  wants_tv INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kk_premiums (
  year INTEGER NOT NULL,
  insurer_id TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  canton TEXT NOT NULL,
  region INTEGER NOT NULL,
  age_class TEXT NOT NULL,
  accident INTEGER NOT NULL,
  franchise INTEGER NOT NULL,
  model TEXT NOT NULL,
  tariff_name TEXT NOT NULL,
  premium REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS kk_premiums_lookup ON kk_premiums(year, canton, region);
CREATE TABLE IF NOT EXISTS kk_regions (
  plz TEXT NOT NULL,
  canton TEXT NOT NULL,
  region INTEGER NOT NULL,
  place TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS kk_regions_plz ON kk_regions(plz);
CREATE TABLE IF NOT EXISTS data_imports (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  rows INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'auto',
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT,
  last_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`;

/** Spalten, die nach dem ersten Release dazukamen (SQLite kennt kein ADD COLUMN IF NOT EXISTS). */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ['profiles', 'persons', "persons TEXT NOT NULL DEFAULT '[]'"],
  ['profiles', 'kk_models', "kk_models TEXT NOT NULL DEFAULT 'alle'"],
  ['contracts', 'review_on', 'review_on TEXT'],
  ['contracts', 'last_reviewed_at', 'last_reviewed_at TEXT'],
];

function migrate(d: DatabaseSync): void {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!db) {
    const file = process.env.ABO_DB_PATH ?? path.join(process.cwd(), 'data', 'abo-pilot.db');
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
    migrate(db);
    seedOffers(db);
    seedSources(db);
  }
  return db;
}

/** Legt die Start-Entwürfe einmalig an; bestehende Angebote werden nie überschrieben. */
function seedOffers(d: DatabaseSync): void {
  const insert = d.prepare(
    `INSERT OR IGNORE INTO offers (id, category, provider, name, monthly_price, promo_price, promo_months, bonus_chf,
      one_time_fee_chf, new_customer_lock_months, commission_chf, data_gb, roaming_eu, speed_mbps, includes_tv,
      min_term_months, valid_until, source_url, checked_at, status, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const o of SEED_OFFERS) {
    insert.run(o.id, o.category, o.provider, o.name, o.monthlyPrice, o.promoPrice, o.promoMonths, o.bonusChf, o.oneTimeFeeChf,
      o.newCustomerLockMonths, o.commissionChf, o.dataGb, o.roamingEu ? 1 : 0, o.speedMbps, o.includesTv ? 1 : 0,
      o.minTermMonths, o.validUntil, o.sourceUrl, o.checkedAt, o.status, o.notes, nowISO());
  }
}

function seedSources(d: DatabaseSync): void {
  const insert = d.prepare('INSERT OR IGNORE INTO sources (category, provider, url, method, active, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const s of SEED_SOURCES) insert.run(s.category, s.provider, s.url, s.method, 0, nowISO());
}

/** Mehrere Schreibvorgänge atomar ausführen. */
export function transaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}
