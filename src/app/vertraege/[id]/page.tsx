import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { Avatar, Icon } from '@/components/Icon';
import { requireUser } from '@/lib/auth';
import { formatChf, HORIZON_MONTHS } from '@/lib/benefit';
import { CATEGORIES, categoryLabel, isCategory } from '@/lib/categories';
import { formatCH, today } from '@/lib/dates';
import { URGENCY_LABEL } from '@/lib/deadlines';
import { offerContext } from '@/lib/context';
import { historyOf, viewContract } from '@/lib/overview';
import { getContract, listContracts, listSwitches } from '@/lib/repo';
import { markCancelled, reactivate, recordSwitch, removeContract } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const contract = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!contract) notFound();

  const todayISO = today();
  const ctx = offerContext(user.id);
  const view = viewContract(contract, historyOf(listContracts(user.id), listSwitches(user.id)), todayISO, ctx);
  const stage = isCategory(contract.category) ? CATEGORIES[contract.category].stage : 0;
  const active = contract.status === 'aktiv';

  const best = view.best;
  const offerLine = (r: (typeof view.offers)[number]) =>
    `${r.offer.name} · ${formatChf(r.offer.monthlyPrice)}/Mt.` +
    (r.offer.promoPrice !== null && r.offer.promoMonths > 0
      ? r.offer.promoMonths >= 999
        ? `, dauerhaft ${formatChf(r.offer.promoPrice)}`
        : `, ${r.offer.promoMonths} Mt. à ${formatChf(r.offer.promoPrice)}`
      : '');

  return (
    <>
      <Link href="/dashboard" className="back"><Icon name="arrowLeft" /> Übersicht</Link>
      <div className="detail-head">
        <Avatar name={contract.provider} size="lg" />
        <div className="titles">
          <h1>{contract.provider}</h1>
          <div className="muted">
            {categoryLabel(contract.category)}
            {contract.product && ` · ${contract.product}`} · <span className="tabular">{formatChf(contract.monthly_price)}</span> pro Monat
          </div>
        </div>
        <div className="actions">
          <Link className="button secondary" href={`/vertraege/${contract.id}/bearbeiten`}>Bearbeiten</Link>
          {active && <Link className="button" href={`/vertraege/${contract.id}/kuendigung`}><Icon name="mail" /> Kündigungsbrief</Link>}
        </div>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-title">
            <h3>Kündigungsfrist</h3>
            {active && <span className={`badge ${view.urgency}`}>{URGENCY_LABEL[view.urgency]}</span>}
          </div>
          {active ? (
            <>
              <div className="muted small">Kündigung muss eintreffen bis</div>
              <div className="big-date">{formatCH(view.deadline.deadline)}</div>
              <div className="muted small">
                {view.deadline.kind !== 'unbefristet' && `noch ${view.deadline.daysLeft} Tage · `}Vertragsende frühestens {formatCH(view.deadline.endDate)}
              </div>
              <p className="small muted">{view.deadline.note}</p>
            </>
          ) : (
            <p>Status: <strong>{contract.status}</strong>{contract.ended_on && ` per ${formatCH(contract.ended_on)}`}</p>
          )}
          <dl className="facts">
            <dt>Vertragsnummer</dt><dd>{contract.customer_number || '–'}</dd>
            <dt>Vertragsbeginn</dt><dd>{formatCH(contract.start_date)}</dd>
            {contract.category !== 'krankenkasse_grund' && (
              <>
                <dt>Laufzeit</dt>
                <dd>
                  {contract.min_term_months ? `${contract.min_term_months} Mt. Mindestlaufzeit` : 'keine Mindestlaufzeit'}
                  {contract.renewal_months ? `, verlängert sich um ${contract.renewal_months} Mt.` : ''}
                </dd>
                <dt>Kündigungsfrist</dt>
                <dd>{contract.notice_months} Mt.{contract.to_month_end ? ' auf Monatsende' : ''}</dd>
              </>
            )}
          </dl>
          {contract.notes && <p className="small muted">{contract.notes}</p>}
          <div className="actions" style={{ marginTop: 16 }}>
            {active ? (
              <form action={markCancelled.bind(null, contract.id)} className="inline-form">
                <button type="submit" className="secondary">Als gekündigt markieren</button>
              </form>
            ) : (
              <form action={reactivate.bind(null, contract.id)} className="inline-form">
                <button type="submit" className="secondary">Wieder aktiv setzen</button>
              </form>
            )}
            <form action={removeContract.bind(null, contract.id)} className="inline-form">
              <ConfirmSubmit message="Vertrag endgültig löschen?">Löschen</ConfirmSubmit>
            </form>
          </div>
        </section>

        <section className={`card ${best && active ? 'kpi hero' : ''}`}>
          {contract.category === 'krankenkasse_grund' ? (
            <>
              <h3>Prämien vergleichen</h3>
              <p className="muted">
                In der Grundversicherung sind die Leistungen bei allen Kassen gleich – es zählt nur die Prämie. Wir rechnen mit
                den offiziellen Zahlen des BAG und erhalten keine Provision.
              </p>
              <Link className="button" href="/krankenkasse"><Icon name="heart" /> Für meinen Haushalt vergleichen</Link>
            </>
          ) : stage === 2 ? (
            <>
              <h3>Wechsel prüfen</h3>
              <p className="muted">Versicherungsvergleiche folgen in einer späteren Version. Bis dahin überwachen wir Ihre Frist.</p>
            </>
          ) : best && active ? (
            <>
              <span className="label"><Icon name="tag" /> Bester Wechsel für Sie</span>
              <span className="value">+{formatChf(best.netBenefit)}</span>
              <span className="sub">
                in 24 Monaten mit <strong>{best.offer.provider} {best.offer.name}</strong>
              </span>
              <div className="actions" style={{ marginTop: 12 }}>
                <form action={recordSwitch.bind(null, contract.id, best.offer.id)} className="inline-form">
                  <button type="submit" className="good">Wechsel vormerken</button>
                </form>
                <a className="button secondary" href={best.offer.sourceUrl} target="_blank" rel="noreferrer">Zum Angebot</a>
              </div>
            </>
          ) : (
            <>
              <h3>Wechsel prüfen</h3>
              <p className="muted">
                {view.offers.length === 0
                  ? 'Zurzeit haben wir hier kein geprüftes, aktuelles Angebot. Wir überwachen Ihre Frist und melden uns.'
                  : 'Kein passendes Angebot ist günstiger als Ihr heutiger Vertrag. Gut gewählt!'}
              </p>
            </>
          )}
        </section>
      </div>

      {view.offers.length > 0 && stage === 1 && (
        <>
          <div className="card-title" style={{ marginTop: 32 }}>
            <h2 style={{ margin: 0 }}>Alle Angebote</h2>
            <span className="small muted">heute {formatChf(view.offers[0].currentCost)} in 24 Mt.</span>
          </div>
          {!ctx.profile && (
            <p className="notice info small">
              Tipp: Mit Ihrem <Link href="/start">Profil</Link> blenden wir Angebote aus, die nicht zu Ihrer Nutzung passen.
            </p>
          )}
          <div className="offers">
            {view.offers.map((r) => {
              const isBest = best?.offer.id === r.offer.id;
              return (
                <article key={r.offer.id} className={`offer ${isBest ? 'best' : ''} ${r.gaps.length > 0 ? 'dim' : ''}`}>
                  <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
                    <Avatar name={r.offer.provider} />
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        {r.offer.provider} {isBest && <span className="badge gruen" style={{ marginLeft: 6 }}>Beste Wahl</span>}
                      </h3>
                      <div className="price">{offerLine(r)}</div>
                      <div className="facts">
                        {r.offer.category === 'mobile' && <span className="badge plain">{r.offer.dataGb === null ? 'Unlimitiert' : `${r.offer.dataGb} GB`}</span>}
                        {r.offer.category === 'mobile' && r.offer.roamingEu && <span className="badge plain">EU-Roaming</span>}
                        {r.offer.speedMbps !== null && <span className="badge plain">{r.offer.speedMbps >= 1000 ? `${r.offer.speedMbps / 1000} Gbit/s` : `${r.offer.speedMbps} Mbit/s`}</span>}
                        {r.offer.includesTv && <span className="badge plain">TV</span>}
                        {r.offer.minTermMonths > 0 && <span className="badge plain">{r.offer.minTermMonths} Mt. Laufzeit</span>}
                        {r.bonus > 0 && <span className="badge gruen">Prämie {formatChf(r.bonus)}</span>}
                        {r.oneTimeFee > 0 && <span className="badge plain">einmalig {formatChf(r.oneTimeFee)}</span>}
                        {r.offer.validUntil && <span className="badge orange">Aktion bis {formatCH(r.offer.validUntil)}</span>}
                      </div>
                      {r.gaps.length > 0 && <div className="warnline">Passt nicht ganz: {r.gaps.join(', ')}</div>}
                      {r.ineligibleReason && <div className="errline">{r.ineligibleReason}</div>}
                      <div className="fine">
                        Geprüft am {formatCH(r.offer.checkedAt)} · <a href={r.offer.sourceUrl} target="_blank" rel="noreferrer">Anbieterseite</a> ·
                        Provision an Abo-Pilot {formatChf(r.offer.commissionChf)} (ohne Einfluss auf die Reihenfolge)
                      </div>
                    </div>
                  </div>
                  <div className="side">
                    <span className={`gain ${r.netBenefit > 0 ? 'pos' : 'neg'}`}>{r.netBenefit > 0 ? '+' : ''}{formatChf(r.netBenefit)}</span>
                    <span className="gain-label">Vorteil in {HORIZON_MONTHS} Mt.</span>
                    {active && r.netBenefit > 0 && r.gaps.length === 0 && (
                      <form action={recordSwitch.bind(null, contract.id, r.offer.id)} className="inline-form">
                        <button type="submit" className={isBest ? 'good' : 'secondary'}>Vormerken</button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            Vorteil = heutige Kosten − neue Kosten + Prämie − Einmalkosten, über {HORIZON_MONTHS} Monate. Sortiert nur nach Ihrem Nutzen.
          </p>
        </>
      )}
    </>
  );
}
