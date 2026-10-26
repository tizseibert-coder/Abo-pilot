import { getDb, nowISO, transaction } from '../db';
import type { KkModel, Person, PremiumRow, RegionRow } from './premiums';

export function replacePremiums(rows: PremiumRow[], source: string): { years: number[]; count: number } {
  const years = [...new Set(rows.map((r) => r.year))].sort();
  transaction(() => {
    const d = getDb();
    for (const y of years) d.prepare('DELETE FROM kk_premiums WHERE year = ?').run(y);
    const insert = d.prepare(
      `INSERT INTO kk_premiums (year, insurer_id, insurer_name, canton, region, age_class, accident, franchise, model, tariff_name, premium)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      insert.run(r.year, r.insurerId, r.insurerName, r.canton, r.region, r.ageClass, r.accident ? 1 : 0, r.franchise, r.model, r.tariffName, r.premium);
    }
    d.prepare('INSERT INTO data_imports (kind, source, rows, note, imported_at) VALUES (?, ?, ?, ?, ?)').run(
      'kk_premiums',
      source,
      rows.length,
      `Jahre ${years.join(', ')}`,
      nowISO(),
    );
  });
  return { years, count: rows.length };
}

export function replaceRegions(rows: RegionRow[], source: string): number {
  transaction(() => {
    const d = getDb();
    d.exec('DELETE FROM kk_regions');
    const insert = d.prepare('INSERT INTO kk_regions (plz, canton, region, place) VALUES (?, ?, ?, ?)');
    for (const r of rows) insert.run(r.plz, r.canton, r.region, r.place);
    d.prepare('INSERT INTO data_imports (kind, source, rows, note, imported_at) VALUES (?, ?, ?, ?, ?)').run('kk_regions', source, rows.length, '', nowISO());
  });
  return rows.length;
}

/** Alle Kanton/Region-Kombinationen einer PLZ (eine PLZ kann mehrere Gemeinden umfassen). */
export function regionsForPlz(plz: string): { canton: string; region: number; places: string }[] {
  const rows = getDb().prepare('SELECT canton, region, place FROM kk_regions WHERE plz = ? ORDER BY canton, region').all(plz) as unknown as RegionRow[];
  const map = new Map<string, { canton: string; region: number; places: string[] }>();
  for (const r of rows) {
    const key = `${r.canton}-${r.region}`;
    const e = map.get(key) ?? { canton: r.canton, region: r.region, places: [] };
    if (r.place && !e.places.includes(r.place)) e.places.push(r.place);
    map.set(key, e);
  }
  return [...map.values()].map((e) => ({ ...e, places: e.places.join(', ') }));
}

export function premiumYears(): number[] {
  return (getDb().prepare('SELECT DISTINCT year FROM kk_premiums ORDER BY year DESC').all() as { year: number }[]).map((r) => r.year);
}

interface PremiumDbRow {
  year: number;
  insurer_id: string;
  insurer_name: string;
  canton: string;
  region: number;
  age_class: string;
  accident: number;
  franchise: number;
  model: string;
  tariff_name: string;
  premium: number;
}

export function premiumsFor(year: number, canton: string, region: number): PremiumRow[] {
  const rows = getDb().prepare('SELECT * FROM kk_premiums WHERE year = ? AND canton = ? AND region = ?').all(year, canton, region) as unknown as PremiumDbRow[];
  return rows.map((r) => ({
    year: r.year,
    insurerId: r.insurer_id,
    insurerName: r.insurer_name,
    canton: r.canton,
    region: r.region,
    ageClass: r.age_class as PremiumRow['ageClass'],
    accident: r.accident === 1,
    franchise: r.franchise,
    model: r.model as KkModel,
    tariffName: r.tariff_name,
    premium: r.premium,
  }));
}

export function lastImports(): { kind: string; source: string; rows: number; note: string; imported_at: string }[] {
  return getDb().prepare('SELECT kind, source, rows, note, imported_at FROM data_imports ORDER BY id DESC LIMIT 10').all() as never;
}

// ---------- Haushalts-Angaben für die Krankenkasse (im Profil gespeichert) ----------

export interface HealthSettings {
  persons: Person[];
  /** 'alle' = alle Modelle vergleichen, sonst nur die genannten */
  models: KkModel[] | 'alle';
}

const ALL_MODELS: KkModel[] = ['BASE', 'HAM', 'HMO', 'DIV'];

export function modelsOf(s: HealthSettings): KkModel[] {
  return s.models === 'alle' ? ALL_MODELS : s.models;
}

export function getHealthSettings(userId: number): HealthSettings {
  const r = getDb().prepare('SELECT persons, kk_models FROM profiles WHERE user_id = ?').get(userId) as
    | { persons: string; kk_models: string }
    | undefined;
  if (!r) return { persons: [], models: 'alle' };
  let persons: Person[] = [];
  try {
    const parsed: unknown = JSON.parse(r.persons);
    if (Array.isArray(parsed)) {
      persons = parsed
        .filter((p): p is Person => typeof p === 'object' && p !== null && typeof p.birthYear === 'number' && typeof p.franchise === 'number')
        .map((p) => ({ birthYear: p.birthYear, franchise: p.franchise, accident: p.accident === true }));
    }
  } catch {
    persons = [];
  }
  const models = r.kk_models === 'alle' ? 'alle' : (r.kk_models.split(',').filter((m): m is KkModel => (ALL_MODELS as string[]).includes(m)));
  return { persons, models: models === 'alle' || models.length === 0 ? 'alle' : models };
}

export function saveHealthSettings(userId: number, s: HealthSettings): void {
  getDb()
    .prepare(
      `INSERT INTO profiles (user_id, updated_at, persons, kk_models) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET persons = excluded.persons, kk_models = excluded.kk_models, updated_at = excluded.updated_at`,
    )
    .run(userId, nowISO(), JSON.stringify(s.persons), s.models === 'alle' ? 'alle' : s.models.join(','));
}
