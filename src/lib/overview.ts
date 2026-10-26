import { rankOffers, type BenefitResult, type PastContract } from './benefit';
import { computeDeadline, urgency, type DeadlineInfo, type Urgency } from './deadlines';
import type { ISODate } from './dates';
import type { Offer } from './offer-types';
import type { Profile } from './profile';
import type { Contract, Switch } from './repo';

export interface ContractView {
  contract: Contract;
  deadline: DeadlineInfo;
  urgency: Urgency;
  offers: BenefitResult[];
  best: BenefitResult | null;
}

export function historyOf(contracts: Contract[], switches: Switch[]): PastContract[] {
  const history: PastContract[] = contracts.map((c) => ({ provider: c.provider, endedOn: c.status === 'aktiv' ? null : c.ended_on }));
  // Vorgemerkte Wechsel zählen als laufende Kundenbeziehung beim neuen Anbieter.
  for (const s of switches) history.push({ provider: s.new_provider, endedOn: null });
  return history;
}

export interface OfferContext {
  offersFor: (category: string) => Offer[];
  profile: Profile | null;
}

const NO_OFFERS: OfferContext = { offersFor: () => [], profile: null };

export function viewContract(c: Contract, history: PastContract[], todayISO: ISODate, ctx: OfferContext = NO_OFFERS): ContractView {
  const deadline = computeDeadline(
    {
      category: c.category,
      startDate: c.start_date,
      minTermMonths: c.min_term_months,
      renewalMonths: c.renewal_months,
      noticeMonths: c.notice_months,
      toMonthEnd: c.to_month_end === 1,
    },
    todayISO,
  );
  const offers = rankOffers(c.monthly_price, ctx.offersFor(c.category), history, todayISO, ctx.profile);
  const best = offers.find((o) => o.netBenefit > 0 && o.gaps.length === 0) ?? null;
  return { contract: c, deadline, urgency: urgency(deadline), offers, best };
}

const URGENCY_ORDER: Record<Urgency, number> = { rot: 0, orange: 1, gelb: 2, gruen: 3, frei: 4 };

export function buildOverview(contracts: Contract[], switches: Switch[], todayISO: ISODate, ctx: OfferContext = NO_OFFERS) {
  const history = historyOf(contracts, switches);
  const active = contracts.filter((c) => c.status === 'aktiv');
  const views = active
    .map((c) => viewContract(c, history, todayISO, ctx))
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.deadline.deadline.localeCompare(b.deadline.deadline));
  const monthlyTotal = active.reduce((s, c) => s + c.monthly_price, 0);
  const potential = views.reduce((s, v) => s + (v.best?.netBenefit ?? 0), 0);
  return { views, monthlyTotal, potential, inactive: contracts.filter((c) => c.status !== 'aktiv') };
}
