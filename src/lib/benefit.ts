import type { Offer } from '@/data/offers';
import { addMonths, parseISO, type ISODate } from './dates';

export const HORIZON_MONTHS = 24;

export interface PastContract {
  provider: string;
  /** Ende der Kundenbeziehung; null = noch Kunde */
  endedOn: ISODate | null;
}

export interface BenefitResult {
  offer: Offer;
  currentCost: number;
  offerCost: number;
  bonus: number;
  oneTimeFee: number;
  /** Nettonutzen über 24 Monate in CHF; positiv = Wechsel lohnt */
  netBenefit: number;
  eligibleForBonus: boolean;
  ineligibleReason: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function offerCost(offer: Offer, months = HORIZON_MONTHS): number {
  const promoMonths = offer.promoPrice === null ? 0 : Math.min(offer.promoMonths, months);
  return round2(promoMonths * (offer.promoPrice ?? 0) + (months - promoMonths) * offer.monthlyPrice);
}

function sameProvider(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Prüft die Neukunden-Sperrfrist des Angebots gegen die bisherigen Verträge des Haushalts. */
export function bonusEligibility(offer: Offer, history: PastContract[], todayISO: ISODate): string | null {
  for (const h of history) {
    if (!sameProvider(h.provider, offer.provider)) continue;
    if (h.endedOn === null) return `Sie sind bereits Kundin oder Kunde bei ${offer.provider}.`;
    if (offer.newCustomerLockMonths > 0 && addMonths(parseISO(h.endedOn), offer.newCustomerLockMonths) > parseISO(todayISO)) {
      return `Neukunden-Sperrfrist: ${offer.newCustomerLockMonths} Monate seit Vertragsende bei ${offer.provider} noch nicht vorbei.`;
    }
  }
  return null;
}

/**
 * Rangliste nach Nettonutzen. Die Provision fliesst bewusst NICHT in die Sortierung ein
 * (Transparenz-Charta, UWG Art. 3 Abs. 1 lit. e).
 */
export function rankOffers(currentMonthly: number, offers: Offer[], history: PastContract[], todayISO: ISODate): BenefitResult[] {
  const currentCost = round2(currentMonthly * HORIZON_MONTHS);
  return offers
    .map((offer) => {
      const reason = bonusEligibility(offer, history, todayISO);
      const bonus = reason ? 0 : offer.bonusChf;
      const cost = offerCost(offer);
      return {
        offer,
        currentCost,
        offerCost: cost,
        bonus,
        oneTimeFee: offer.oneTimeFeeChf,
        netBenefit: round2(currentCost - cost + bonus - offer.oneTimeFeeChf),
        eligibleForBonus: reason === null,
        ineligibleReason: reason,
      };
    })
    .sort((a, b) => b.netBenefit - a.netBenefit || a.offer.id.localeCompare(b.offer.id));
}

export function formatChf(n: number): string {
  const sign = n < 0 ? '−' : '';
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${sign}CHF ${int.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${dec}`;
}
