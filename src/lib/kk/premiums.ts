// Grundversicherung (KVG): Prämienrechner auf Basis der offiziellen BAG-Prämiendaten.
// Reine Funktionen ohne Datenbank, damit sie testbar bleiben.

import { findColumn, parseCsvTable } from '../csv';

export type AgeClass = 'KIN' | 'JUG' | 'ERW';
export type KkModel = 'BASE' | 'HAM' | 'HMO' | 'DIV';

export const AGE_CLASS_LABEL: Record<AgeClass, string> = { KIN: 'Kind (0–18)', JUG: 'Junge Erwachsene (19–25)', ERW: 'Erwachsene (26+)' };
export const MODEL_LABEL: Record<KkModel, string> = { BASE: 'Standard (freie Arztwahl)', HAM: 'Hausarzt', HMO: 'HMO', DIV: 'Telmed / andere' };

export const FRANCHISES: Record<'KIN' | 'ADULT', number[]> = {
  KIN: [0, 100, 200, 300, 400, 600],
  ADULT: [300, 500, 1000, 1500, 2000, 2500],
};

export interface PremiumRow {
  year: number;
  insurerId: string;
  insurerName: string;
  canton: string;
  region: number;
  ageClass: AgeClass;
  accident: boolean;
  franchise: number;
  model: KkModel;
  tariffName: string;
  /** Monatsprämie in CHF */
  premium: number;
}

export interface Person {
  birthYear: number;
  franchise: number;
  /** Unfalldeckung über die Krankenkasse (nötig, wenn nicht über den Arbeitgeber versichert) */
  accident: boolean;
}

export function ageClass(birthYear: number, year: number): AgeClass {
  const age = year - birthYear;
  if (age <= 18) return 'KIN';
  if (age <= 25) return 'JUG';
  return 'ERW';
}

export function franchisesFor(ac: AgeClass): number[] {
  return ac === 'KIN' ? FRANCHISES.KIN : FRANCHISES.ADULT;
}

/** Ungültige Franchise auf die nächstgelegene gültige setzen (z. B. Kind wird erwachsen). */
export function normalizeFranchise(ac: AgeClass, franchise: number): number {
  const options = franchisesFor(ac);
  return options.reduce((best, f) => (Math.abs(f - franchise) < Math.abs(best - franchise) ? f : best), options[0]);
}

export interface PersonQuote {
  tariffName: string;
  model: KkModel;
  premium: number;
}

export interface InsurerQuote {
  insurerId: string;
  insurerName: string;
  monthlyTotal: number;
  perPerson: PersonQuote[];
}

/**
 * Günstigste Variante pro Kasse für den ganzen Haushalt. Eine Kasse erscheint nur, wenn sie
 * für jede Person ein passendes Angebot hat. `rows` sind bereits auf Jahr, Kanton und Region gefiltert.
 */
export function quoteHousehold(rows: PremiumRow[], persons: Person[], year: number, models: KkModel[]): InsurerQuote[] {
  if (persons.length === 0) return [];
  const byInsurer = new Map<string, PremiumRow[]>();
  for (const r of rows) {
    if (!models.includes(r.model)) continue;
    const list = byInsurer.get(r.insurerId) ?? [];
    list.push(r);
    byInsurer.set(r.insurerId, list);
  }
  const quotes: InsurerQuote[] = [];
  for (const [insurerId, list] of byInsurer) {
    const perPerson: PersonQuote[] = [];
    for (const p of persons) {
      const ac = ageClass(p.birthYear, year);
      const franchise = normalizeFranchise(ac, p.franchise);
      const best = list
        .filter((r) => r.ageClass === ac && r.franchise === franchise && r.accident === p.accident)
        .reduce<PremiumRow | null>((min, r) => (min === null || r.premium < min.premium ? r : min), null);
      if (!best) break;
      perPerson.push({ tariffName: best.tariffName, model: best.model, premium: best.premium });
    }
    if (perPerson.length !== persons.length) continue;
    const total = Math.round(perPerson.reduce((s, q) => s + q.premium, 0) * 100) / 100;
    quotes.push({ insurerId, insurerName: list[0].insurerName || insurerId, monthlyTotal: total, perPerson });
  }
  return quotes.sort((a, b) => a.monthlyTotal - b.monthlyTotal || a.insurerName.localeCompare(b.insurerName));
}

// ---------- Import der BAG-Dateien ----------

const COLS = {
  insurerId: ['versicherer', 'versichererid', 'gid', 'bagnr', 'insurer', 'insurerid', 'assureur'],
  insurerName: ['versicherername', 'versicherungsname', 'name', 'insurername', 'nomassureur'],
  canton: ['kanton', 'canton'],
  region: ['region', 'pramienregion', 'regionid'],
  ageClass: ['altersklasse', 'agegroup', 'classedage', 'agegroupid'],
  accident: ['unfalleinschluss', 'unfall', 'accident', 'couvertureaccident'],
  year: ['tarifjahr', 'geschaftsjahr', 'jahr', 'year', 'annee'],
  franchise: ['franchise', 'deductible'],
  premium: ['pramie', 'praemie', 'premium', 'prime'],
  model: ['tariftyp', 'tarifart', 'modell', 'tariftype', 'typetarif'],
  tariffName: ['tarifbezeichnung', 'tarifname', 'tarif', 'tariffname', 'designationtarif'],
  subgroup: ['altersuntergruppe', 'agesubgroup', 'sousgroupedage'],
};

const num = (s: string) => Number(s.replace(/['’\s]/g, '').replace(',', '.'));

function toAgeClass(v: string): AgeClass | null {
  if (/KIN|kind|enfant|child/i.test(v)) return 'KIN';
  if (/JUG|jung|jeune|young/i.test(v)) return 'JUG';
  if (/ERW|erwachsen|adulte|adult/i.test(v)) return 'ERW';
  return null;
}

function toModel(v: string): KkModel {
  if (/BASE|standard|ordinaire/i.test(v)) return 'BASE';
  if (/HAM|hausarzt|médecin de famille|medecin de famille/i.test(v)) return 'HAM';
  if (/HMO/i.test(v)) return 'HMO';
  return 'DIV';
}

export interface ImportResult<T> {
  rows: T[];
  errors: string[];
}

/**
 * Liest die BAG-Prämientabelle (CSV). Die Spaltennamen werden tolerant erkannt, weil das BAG
 * sie zwischen den Jahren und Sprachen leicht ändert. Ergebnis immer mit Stichproben prüfen.
 */
export function parseBagPremiums(text: string): ImportResult<PremiumRow> {
  const { header, rows } = parseCsvTable(text);
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, c]) => [k, findColumn(header, c)])) as Record<keyof typeof COLS, number>;
  const required: (keyof typeof COLS)[] = ['insurerId', 'canton', 'region', 'ageClass', 'accident', 'year', 'franchise', 'premium'];
  const missing = required.filter((k) => idx[k] < 0);
  if (missing.length) return { rows: [], errors: [`Spalten nicht gefunden: ${missing.join(', ')}. Gefunden: ${header.join(', ')}`] };

  const out: PremiumRow[] = [];
  const errors: string[] = [];
  const cell = (r: string[], k: keyof typeof COLS) => (idx[k] >= 0 ? (r[idx[k]] ?? '') : '');
  rows.forEach((r, i) => {
    // Nur die erste Altersuntergruppe (z. B. erstes Kind); weitere Kinder erhalten bei manchen Kassen Rabatte.
    const sub = cell(r, 'subgroup');
    if (sub && /[2-9]\s*$/.test(sub)) return;
    const ac = toAgeClass(cell(r, 'ageClass'));
    const regionMatch = cell(r, 'region').match(/(\d+)\s*$/);
    const premium = num(cell(r, 'premium'));
    const franchise = Number(cell(r, 'franchise').replace(/\D/g, ''));
    const year = Number(cell(r, 'year').replace(/\D/g, '').slice(0, 4));
    if (!ac || !regionMatch || !Number.isFinite(premium) || !Number.isFinite(franchise) || year < 2000) {
      if (errors.length < 20) errors.push(`Zeile ${i + 2}: unlesbar (${r.slice(0, 6).join(' | ')})`);
      return;
    }
    const acc = cell(r, 'accident');
    out.push({
      year,
      insurerId: cell(r, 'insurerId'),
      insurerName: cell(r, 'insurerName'),
      canton: cell(r, 'canton').toUpperCase().slice(0, 2),
      region: Number(regionMatch[1]),
      ageClass: ac,
      accident: /MIT|^ja$|^1$|true|avec|with/i.test(acc) && !/OHNE|sans|without/i.test(acc),
      franchise,
      model: toModel(cell(r, 'model')),
      tariffName: cell(r, 'tariffName'),
      premium,
    });
  });
  return { rows: out, errors };
}

export interface RegionRow {
  plz: string;
  canton: string;
  region: number;
  place: string;
}

const REGION_COLS = {
  plz: ['plz', 'postleitzahl', 'npa', 'zip'],
  canton: ['kanton', 'canton'],
  region: ['region', 'pramienregion'],
  place: ['ort', 'gemeinde', 'ortschaft', 'localite', 'commune', 'ortsbezeichnung'],
};

/** Liest die Zuordnung PLZ → Kanton → Prämienregion (BAG-Liste der Prämienregionen). */
export function parseRegions(text: string): ImportResult<RegionRow> {
  const { header, rows } = parseCsvTable(text);
  const idx = Object.fromEntries(Object.entries(REGION_COLS).map(([k, c]) => [k, findColumn(header, c)])) as Record<keyof typeof REGION_COLS, number>;
  const missing = (['plz', 'canton', 'region'] as const).filter((k) => idx[k] < 0);
  if (missing.length) return { rows: [], errors: [`Spalten nicht gefunden: ${missing.join(', ')}. Gefunden: ${header.join(', ')}`] };
  const out: RegionRow[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const plz = (r[idx.plz] ?? '').replace(/\D/g, '');
    const m = (r[idx.region] ?? '').match(/(\d+)\s*$/);
    if (plz.length !== 4 || !m) {
      if (errors.length < 20) errors.push(`Zeile ${i + 2}: unlesbar`);
      return;
    }
    out.push({ plz, canton: (r[idx.canton] ?? '').toUpperCase().slice(0, 2), region: Number(m[1]), place: idx.place >= 0 ? (r[idx.place] ?? '') : '' });
  });
  return { rows: out, errors };
}
