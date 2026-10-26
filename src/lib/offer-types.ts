import type { Category } from './categories';
import { diffDays, parseISO, type ISODate } from './dates';

export type OfferStatus = 'entwurf' | 'geprüft' | 'archiviert';

export interface Offer {
  id: string;
  category: Category;
  provider: string;
  name: string;
  /** regulärer Monatspreis in CHF inkl. MWST */
  monthlyPrice: number;
  /** Aktionspreis in den ersten promoMonths Monaten (999 = dauerhaft) */
  promoPrice: number | null;
  promoMonths: number;
  /** Willkommensprämie / Gutschrift in CHF */
  bonusChf: number;
  /** Aktivierung, Gerät, Router usw. */
  oneTimeFeeChf: number;
  /** Prämie und Aktionspreis nur, wenn man in den letzten n Monaten nicht Kunde war */
  newCustomerLockMonths: number;
  /** Provision an Abo-Pilot; wird offengelegt, beeinflusst die Rangliste nicht */
  commissionChf: number;
  /** Handy: Daten in der Schweiz in GB, null = unlimitiert */
  dataGb: number | null;
  /** Handy: Roaming in der EU inklusive */
  roamingEu: boolean;
  /** Internet: Download in Mbit/s */
  speedMbps: number | null;
  includesTv: boolean;
  minTermMonths: number;
  /** Aktion gültig bis (Abschlussdatum) */
  validUntil: ISODate | null;
  sourceUrl: string;
  /** Datum der letzten Prüfung auf der Anbieterseite */
  checkedAt: ISODate | null;
  status: OfferStatus;
  notes: string;
}

/** Nach so vielen Tagen ohne neue Prüfung wird ein Angebot Kunden nicht mehr gezeigt. */
export const STALE_AFTER_DAYS = 30;

export type OfferVisibility = 'sichtbar' | 'entwurf' | 'abgelaufen' | 'veraltet' | 'archiviert';

export function offerVisibility(o: Offer, todayISO: ISODate): OfferVisibility {
  if (o.status === 'archiviert') return 'archiviert';
  if (o.validUntil && o.validUntil < todayISO) return 'abgelaufen';
  if (o.status !== 'geprüft' || !o.checkedAt) return 'entwurf';
  if (diffDays(parseISO(o.checkedAt), parseISO(todayISO)) > STALE_AFTER_DAYS) return 'veraltet';
  return 'sichtbar';
}

/** Spalten für CSV-Import und Partner-Feeds */
export const CSV_COLUMNS = [
  'id', 'category', 'provider', 'name', 'monthly_price', 'promo_price', 'promo_months', 'bonus_chf', 'one_time_fee_chf',
  'new_customer_lock_months', 'commission_chf', 'data_gb', 'roaming_eu', 'speed_mbps', 'includes_tv', 'min_term_months',
  'valid_until', 'source_url', 'notes',
] as const;
