import Anthropic from '@anthropic-ai/sdk';
import { categoryLabel, isCategory } from '../categories';
import { formatCH, today } from '../dates';
import { getDb, nowISO } from '../db';
import type { Offer } from '../offer-types';
import { getOffer, setOfferStatus, upsertOffer } from '../offers';
import { extractJsonLd, extractWithClaude, type Candidate } from './extract';
import { fetchPage, htmlToText } from './page';

export type SourceMethod = 'auto' | 'jsonld' | 'ki';

export interface Source {
  id: number;
  category: string;
  provider: string;
  url: string;
  method: SourceMethod;
  active: number;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string;
}

export function listSources(): Source[] {
  return getDb().prepare('SELECT * FROM sources ORDER BY category, provider').all() as unknown as Source[];
}

export function getSource(id: number): Source | undefined {
  return getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source | undefined;
}

export function saveSource(s: Pick<Source, 'category' | 'provider' | 'url' | 'method' | 'active'>, id?: number): void {
  if (id) {
    getDb().prepare('UPDATE sources SET category = ?, provider = ?, url = ?, method = ?, active = ? WHERE id = ?').run(s.category, s.provider, s.url, s.method, s.active, id);
  } else {
    getDb()
      .prepare('INSERT INTO sources (category, provider, url, method, active, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(s.category, s.provider, s.url, s.method, s.active, nowISO());
  }
}

export function deleteSource(id: number): void {
  getDb().prepare('DELETE FROM sources WHERE id = ?').run(id);
}

function recordRun(id: number, status: 'ok' | 'fehler', message: string): void {
  getDb().prepare('UPDATE sources SET last_run_at = ?, last_status = ?, last_message = ? WHERE id = ?').run(nowISO(), status, message.slice(0, 500), id);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export function offerIdFor(provider: string, name: string): string {
  return `${slug(provider)}-${slug(name)}`.slice(0, 60);
}

const COMPARED: (keyof Candidate & keyof Offer)[] = [
  'monthlyPrice', 'promoPrice', 'promoMonths', 'oneTimeFeeChf', 'dataGb', 'roamingEu', 'speedMbps', 'includesTv', 'minTermMonths', 'validUntil',
];

const LABEL: Partial<Record<keyof Offer, string>> = {
  monthlyPrice: 'Preis', promoPrice: 'Aktionspreis', promoMonths: 'Aktionsdauer', oneTimeFeeChf: 'Einmalkosten', dataGb: 'Daten',
  roamingEu: 'EU-Roaming', speedMbps: 'Speed', includesTv: 'TV', minTermMonths: 'Laufzeit', validUntil: 'gültig bis',
};

export function differences(existing: Offer, c: Candidate): string[] {
  return COMPARED.filter((k) => existing[k] !== c[k]).map((k) => `${LABEL[k]}: ${String(existing[k] ?? '–')} → ${String(c[k] ?? '–')}`);
}

export interface ApplyResult {
  created: number;
  changed: number;
  confirmed: number;
  unchanged: number;
}

/**
 * Kandidaten mit dem Bestand abgleichen:
 * - neu → Entwurf (Prüfung durch das Team)
 * - geändert → zurück auf Entwurf, Änderung in den Notizen
 * - unverändert und geprüft → Prüfdatum auf heute (automatisch bestätigt)
 */
export function applyCandidates(source: Pick<Source, 'category' | 'provider' | 'url'>, candidates: Candidate[], method: string, todayISO = today()): ApplyResult {
  const result: ApplyResult = { created: 0, changed: 0, confirmed: 0, unchanged: 0 };
  if (!isCategory(source.category)) return result;
  const seen = new Set<string>();
  for (const c of candidates) {
    const id = offerIdFor(source.provider, c.name);
    if (seen.has(id)) continue;
    seen.add(id);
    const existing = getOffer(id);
    const stamp = `Automatisch gefunden am ${formatCH(todayISO)} (${method}). Beleg: «${c.evidence}»`;
    const base: Offer = {
      id,
      category: source.category,
      provider: source.provider,
      name: c.name,
      monthlyPrice: c.monthlyPrice,
      promoPrice: c.promoPrice,
      promoMonths: c.promoMonths,
      bonusChf: existing?.bonusChf ?? 0,
      oneTimeFeeChf: c.oneTimeFeeChf,
      newCustomerLockMonths: existing?.newCustomerLockMonths ?? 0,
      commissionChf: existing?.commissionChf ?? 0,
      dataGb: c.dataGb,
      roamingEu: c.roamingEu,
      speedMbps: c.speedMbps,
      includesTv: c.includesTv,
      minTermMonths: c.minTermMonths,
      validUntil: c.validUntil,
      sourceUrl: source.url,
      checkedAt: null,
      status: 'entwurf',
      notes: stamp,
    };
    if (!existing) {
      upsertOffer(base);
      result.created++;
      continue;
    }
    if (existing.status === 'archiviert') continue;
    const diff = differences(existing, c);
    if (diff.length === 0) {
      if (existing.status === 'geprüft') {
        setOfferStatus(id, 'geprüft', todayISO);
        result.confirmed++;
      } else result.unchanged++;
      continue;
    }
    upsertOffer({ ...base, notes: `Änderung erkannt: ${diff.join('; ')}. ${stamp}` });
    result.changed++;
  }
  return result;
}

export async function runSource(source: Source): Promise<string> {
  try {
    const html = await fetchPage(source.url);
    let candidates: Candidate[] = [];
    let method = 'JSON-LD';
    if (source.method !== 'ki') candidates = extractJsonLd(html);
    if (candidates.length === 0 && source.method !== 'jsonld') {
      method = 'KI';
      candidates = await extractWithClaude(htmlToText(html), source.provider, categoryLabel(source.category), source.url);
    }
    const r = applyCandidates(source, candidates, method);
    const message = `${candidates.length} Angebote gelesen (${method}): ${r.created} neu, ${r.changed} geändert, ${r.confirmed} bestätigt, ${r.unchanged} unverändert.`;
    recordRun(source.id, 'ok', message);
    return message;
  } catch (e) {
    const message =
      e instanceof Anthropic.AuthenticationError
        ? 'Keine strukturierten Daten auf der Seite, und für die KI-Extraktion fehlen gültige Anthropic-Zugangsdaten (ANTHROPIC_API_KEY).'
        : e instanceof Anthropic.RateLimitError
          ? 'KI-Extraktion: Rate-Limit erreicht, später erneut versuchen.'
          : e instanceof TypeError && e.message === 'fetch failed'
            ? 'Seite nicht erreichbar (Netzwerk, DNS oder Firewall des Servers).'
            : e instanceof Error
            ? e.message
            : String(e);
    recordRun(source.id, 'fehler', message);
    return `Fehler: ${message}`;
  }
}

const MIN_HOURS_BETWEEN_RUNS = 20;

/** Alle aktiven Quellen nacheinander, höchstens einmal pro Tag je Quelle, mit Pause zwischen den Abrufen. */
export async function runAllSources(force = false): Promise<{ provider: string; message: string }[]> {
  const out: { provider: string; message: string }[] = [];
  const due = listSources().filter(
    (s) => s.active === 1 && (force || !s.last_run_at || Date.now() - Date.parse(s.last_run_at) > MIN_HOURS_BETWEEN_RUNS * 3_600_000),
  );
  for (const [i, s] of due.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 3000));
    out.push({ provider: s.provider, message: await runSource(s) });
  }
  return out;
}
