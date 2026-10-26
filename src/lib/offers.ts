import { CATEGORIES, isCategory } from './categories';
import { parseCsvTable } from './csv';
import { isISODate, today, type ISODate } from './dates';
import { getDb, nowISO } from './db';
import { CSV_COLUMNS, offerVisibility, type Offer, type OfferStatus } from './offer-types';

export { CSV_COLUMNS };

interface OfferRow {
  id: string;
  category: string;
  provider: string;
  name: string;
  monthly_price: number;
  promo_price: number | null;
  promo_months: number;
  bonus_chf: number;
  one_time_fee_chf: number;
  new_customer_lock_months: number;
  commission_chf: number;
  data_gb: number | null;
  roaming_eu: number;
  speed_mbps: number | null;
  includes_tv: number;
  min_term_months: number;
  valid_until: string | null;
  source_url: string;
  checked_at: string | null;
  status: string;
  notes: string;
}

function fromRow(r: OfferRow): Offer {
  return {
    id: r.id,
    category: isCategory(r.category) ? r.category : 'andere',
    provider: r.provider,
    name: r.name,
    monthlyPrice: r.monthly_price,
    promoPrice: r.promo_price,
    promoMonths: r.promo_months,
    bonusChf: r.bonus_chf,
    oneTimeFeeChf: r.one_time_fee_chf,
    newCustomerLockMonths: r.new_customer_lock_months,
    commissionChf: r.commission_chf,
    dataGb: r.data_gb,
    roamingEu: r.roaming_eu === 1,
    speedMbps: r.speed_mbps,
    includesTv: r.includes_tv === 1,
    minTermMonths: r.min_term_months,
    validUntil: r.valid_until,
    sourceUrl: r.source_url,
    checkedAt: r.checked_at,
    status: (['entwurf', 'geprüft', 'archiviert'] as const).find((s) => s === r.status) ?? 'entwurf',
    notes: r.notes,
  };
}

export function listAllOffers(): Offer[] {
  return (getDb().prepare('SELECT * FROM offers ORDER BY category, provider, monthly_price').all() as unknown as OfferRow[]).map(fromRow);
}

/** Nur geprüfte, nicht abgelaufene und nicht veraltete Angebote – das sehen Kundinnen und Kunden. */
export function visibleOffers(category: string, todayISO: ISODate = today()): Offer[] {
  return listAllOffers().filter((o) => o.category === category && offerVisibility(o, todayISO) === 'sichtbar');
}

export function getOffer(id: string): Offer | undefined {
  const r = getDb().prepare('SELECT * FROM offers WHERE id = ?').get(id) as OfferRow | undefined;
  return r ? fromRow(r) : undefined;
}

export function upsertOffer(o: Offer): void {
  getDb()
    .prepare(
      `INSERT INTO offers (id, category, provider, name, monthly_price, promo_price, promo_months, bonus_chf,
        one_time_fee_chf, new_customer_lock_months, commission_chf, data_gb, roaming_eu, speed_mbps, includes_tv,
        min_term_months, valid_until, source_url, checked_at, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET category = excluded.category, provider = excluded.provider, name = excluded.name,
        monthly_price = excluded.monthly_price, promo_price = excluded.promo_price, promo_months = excluded.promo_months,
        bonus_chf = excluded.bonus_chf, one_time_fee_chf = excluded.one_time_fee_chf,
        new_customer_lock_months = excluded.new_customer_lock_months, commission_chf = excluded.commission_chf,
        data_gb = excluded.data_gb, roaming_eu = excluded.roaming_eu, speed_mbps = excluded.speed_mbps,
        includes_tv = excluded.includes_tv, min_term_months = excluded.min_term_months, valid_until = excluded.valid_until,
        source_url = excluded.source_url, checked_at = excluded.checked_at, status = excluded.status, notes = excluded.notes,
        updated_at = excluded.updated_at`,
    )
    .run(o.id, o.category, o.provider, o.name, o.monthlyPrice, o.promoPrice, o.promoMonths, o.bonusChf, o.oneTimeFeeChf,
      o.newCustomerLockMonths, o.commissionChf, o.dataGb, o.roamingEu ? 1 : 0, o.speedMbps, o.includesTv ? 1 : 0,
      o.minTermMonths, o.validUntil, o.sourceUrl, o.checkedAt, o.status, o.notes, nowISO());
}

export function setOfferStatus(id: string, status: OfferStatus, checkedAt?: ISODate): void {
  if (checkedAt) {
    getDb().prepare('UPDATE offers SET status = ?, checked_at = ?, updated_at = ? WHERE id = ?').run(status, checkedAt, nowISO(), id);
  } else {
    getDb().prepare('UPDATE offers SET status = ?, updated_at = ? WHERE id = ?').run(status, nowISO(), id);
  }
}

// ---------- Validierung und CSV-Import (für Partner-Feeds oder Tabellen) ----------


type RawOffer = Partial<Record<(typeof CSV_COLUMNS)[number], string>>;

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s.trim().replace(/['’]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const bool = (s: string | undefined) => ['1', 'ja', 'true', 'yes', 'on'].includes((s ?? '').trim().toLowerCase());

/**
 * Prüft Rohwerte und baut ein Angebot. Importierte oder bearbeitete Angebote sind immer Entwürfe,
 * bis jemand die Quelle geprüft hat (Vier-Augen-Prinzip light).
 */
export function parseOffer(raw: RawOffer): { offer?: Offer; error?: string } {
  const id = (raw.id ?? '').trim().toLowerCase();
  const category = (raw.category ?? '').trim();
  const provider = (raw.provider ?? '').trim();
  const name = (raw.name ?? '').trim();
  const sourceUrl = (raw.source_url ?? '').trim();
  const monthly = num(raw.monthly_price);
  const values = {
    promo: num(raw.promo_price),
    promoMonths: num(raw.promo_months) ?? 0,
    bonus: num(raw.bonus_chf) ?? 0,
    fee: num(raw.one_time_fee_chf) ?? 0,
    lock: num(raw.new_customer_lock_months) ?? 0,
    commission: num(raw.commission_chf) ?? 0,
    data: num(raw.data_gb),
    speed: num(raw.speed_mbps),
    minTerm: num(raw.min_term_months) ?? 0,
  };
  const validUntil = (raw.valid_until ?? '').trim() || null;

  if (!/^[a-z0-9-]{3,60}$/.test(id)) return { error: `ID «${id}»: nur a–z, 0–9 und Bindestrich, 3–60 Zeichen.` };
  if (!isCategory(category)) return { error: `${id}: unbekannte Kategorie «${category}».` };
  // Rechtsrahmen: nur Stufe-1-Kategorien (keine Versicherungen, keine Grundversicherung).
  if (CATEGORIES[category].stage !== 1) return { error: `${id}: Kategorie «${category}» ist für Angebote nicht freigegeben.` };
  if (!provider || !name) return { error: `${id}: Anbieter und Name sind Pflicht.` };
  if (monthly === null || Number.isNaN(monthly) || monthly < 0) return { error: `${id}: Monatspreis fehlt oder ist ungültig.` };
  if (Object.values(values).some((v) => Number.isNaN(v) || (v !== null && v < 0))) return { error: `${id}: eine Zahl ist ungültig.` };
  if (validUntil && !isISODate(validUntil)) return { error: `${id}: «gültig bis» muss JJJJ-MM-TT sein.` };
  if (!/^https:\/\/\S+$/.test(sourceUrl)) return { error: `${id}: Quelle (https-Link) ist Pflicht.` };

  return {
    offer: {
      id, category, provider, name,
      monthlyPrice: monthly,
      promoPrice: values.promo,
      promoMonths: values.promo === null ? 0 : values.promoMonths,
      bonusChf: values.bonus,
      oneTimeFeeChf: values.fee,
      newCustomerLockMonths: values.lock,
      commissionChf: values.commission,
      dataGb: values.data,
      roamingEu: bool(raw.roaming_eu),
      speedMbps: values.speed,
      includesTv: bool(raw.includes_tv),
      minTermMonths: values.minTerm,
      validUntil,
      sourceUrl,
      checkedAt: null,
      status: 'entwurf',
      notes: (raw.notes ?? '').trim().slice(0, 1000),
    },
  };
}

/** CSV mit Kopfzeile in Rohwerte pro Angebot umwandeln. */
export function parseCsv(text: string): RawOffer[] {
  const { header, rows } = parseCsvTable(text);
  const keys = header.map((h) => h.toLowerCase());
  return rows.map((cells) => {
    const raw: Record<string, string> = {};
    keys.forEach((k, i) => {
      raw[k] = cells[i] ?? '';
    });
    return raw as RawOffer;
  });
}
