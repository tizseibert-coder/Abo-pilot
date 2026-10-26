import { getDb, nowISO } from './db';
import type { ISODate } from './dates';

export interface User {
  id: number;
  email: string;
  name: string;
  street: string;
  zip_city: string;
  consent_at: string;
  created_at: string;
}

export interface Contract {
  id: number;
  user_id: number;
  category: string;
  provider: string;
  product: string;
  customer_number: string;
  monthly_price: number;
  start_date: ISODate | null;
  min_term_months: number;
  renewal_months: number;
  notice_months: number;
  to_month_end: number;
  status: 'aktiv' | 'gekündigt' | 'beendet';
  ended_on: ISODate | null;
  notes: string;
  created_at: string;
}

export interface Switch {
  id: number;
  user_id: number;
  contract_id: number | null;
  offer_id: string;
  new_provider: string;
  expected_bonus: number;
  expected_by: ISODate | null;
  status: 'erwartet' | 'erhalten' | 'reklamiert' | 'verfallen';
  created_at: string;
}

export type ContractInput = Omit<Contract, 'id' | 'user_id' | 'created_at' | 'status' | 'ended_on'>;

const USER_COLS = 'id, email, name, street, zip_city, consent_at, created_at';

export function findUserByEmail(email: string): (User & { pw_hash: string }) | undefined {
  return getDb().prepare(`SELECT ${USER_COLS}, pw_hash FROM users WHERE email = ?`).get(email) as (User & { pw_hash: string }) | undefined;
}

export function getUser(id: number): User | undefined {
  return getDb().prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id) as User | undefined;
}

export function createUser(email: string, pwHash: string, name: string): number {
  const now = nowISO();
  const r = getDb().prepare('INSERT INTO users (email, pw_hash, name, consent_at, created_at) VALUES (?, ?, ?, ?, ?)').run(email, pwHash, name, now, now);
  return Number(r.lastInsertRowid);
}

export function updateProfile(userId: number, name: string, street: string, zipCity: string): void {
  getDb().prepare('UPDATE users SET name = ?, street = ?, zip_city = ? WHERE id = ?').run(name, street, zipCity, userId);
}

export function deleteUser(userId: number): void {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export function listContracts(userId: number): Contract[] {
  return getDb().prepare('SELECT * FROM contracts WHERE user_id = ? ORDER BY status, provider').all(userId) as unknown as Contract[];
}

export function getContract(userId: number, id: number): Contract | undefined {
  return getDb().prepare('SELECT * FROM contracts WHERE user_id = ? AND id = ?').get(userId, id) as Contract | undefined;
}

export function createContract(userId: number, c: ContractInput): number {
  const r = getDb()
    .prepare(
      `INSERT INTO contracts (user_id, category, provider, product, customer_number, monthly_price, start_date,
        min_term_months, renewal_months, notice_months, to_month_end, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, c.category, c.provider, c.product, c.customer_number, c.monthly_price, c.start_date, c.min_term_months, c.renewal_months, c.notice_months, c.to_month_end, c.notes, nowISO());
  return Number(r.lastInsertRowid);
}

export function updateContract(userId: number, id: number, c: ContractInput): void {
  getDb()
    .prepare(
      `UPDATE contracts SET category = ?, provider = ?, product = ?, customer_number = ?, monthly_price = ?, start_date = ?,
        min_term_months = ?, renewal_months = ?, notice_months = ?, to_month_end = ?, notes = ?
       WHERE user_id = ? AND id = ?`,
    )
    .run(c.category, c.provider, c.product, c.customer_number, c.monthly_price, c.start_date, c.min_term_months, c.renewal_months, c.notice_months, c.to_month_end, c.notes, userId, id);
}

export function setContractStatus(userId: number, id: number, status: Contract['status'], endedOn: ISODate | null): void {
  getDb().prepare('UPDATE contracts SET status = ?, ended_on = ? WHERE user_id = ? AND id = ?').run(status, endedOn, userId, id);
}

export function deleteContract(userId: number, id: number): void {
  getDb().prepare('DELETE FROM contracts WHERE user_id = ? AND id = ?').run(userId, id);
}

export function listSwitches(userId: number): Switch[] {
  return getDb().prepare('SELECT * FROM switches WHERE user_id = ? ORDER BY created_at DESC').all(userId) as unknown as Switch[];
}

export function createSwitch(userId: number, s: Pick<Switch, 'contract_id' | 'offer_id' | 'new_provider' | 'expected_bonus' | 'expected_by'>): number {
  const r = getDb()
    .prepare('INSERT INTO switches (user_id, contract_id, offer_id, new_provider, expected_bonus, expected_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, s.contract_id, s.offer_id, s.new_provider, s.expected_bonus, s.expected_by, nowISO());
  return Number(r.lastInsertRowid);
}

export function setSwitchStatus(userId: number, id: number, status: Switch['status']): void {
  getDb().prepare('UPDATE switches SET status = ? WHERE user_id = ? AND id = ?').run(status, userId, id);
}
