import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { requireUser } from '@/lib/auth';
import { formatChf, HORIZON_MONTHS } from '@/lib/benefit';
import { CATEGORIES, categoryLabel, isCategory } from '@/lib/categories';
import { formatCH, today } from '@/lib/dates';
import { URGENCY_LABEL } from '@/lib/deadlines';
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
  const view = viewContract(contract, historyOf(listContracts(user.id), listSwitches(user.id)), todayISO);
  const stage = isCategory(contract.category) ? CATEGORIES[contract.category].stage : 0;
  const active = contract.status === 'aktiv';

  return (
    <>
      <p className="small"><Link href="/dashboard">← Übersicht</Link></p>
      <h1>{contract.provider}</h1>
      <p className="lead">
        {categoryLabel(contract.category)}
        {contract.product && ` · ${contract.product}`} · {formatChf(contract.monthly_price)} pro Monat
      </p>

      <div className="grid cols-2">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Frist</h2>
          {active ? (
            <>
              <p>
                <span className={`badge ${view.urgency}`}>{URGENCY_LABEL[view.urgency]}</span>
              </p>
              <p>
                Kündigung muss eintreffen bis <strong>{formatCH(view.deadline.deadline)}</strong>
                {view.deadline.kind !== 'unbefristet' && ` (noch ${view.deadline.daysLeft} Tage)`}.<br />
                Frühestes Vertragsende: <strong>{formatCH(view.deadline.endDate)}</strong>
              </p>
              <p className="muted small">{view.deadline.note}</p>
            </>
          ) : (
            <p>Status: <strong>{contract.status}</strong>{contract.ended_on && ` per ${formatCH(contract.ended_on)}`}</p>
          )}
          <dl className="small muted">
            <div>Kunden-/Vertragsnummer: {contract.customer_number || '–'}</div>
            <div>Vertragsbeginn: {formatCH(contract.start_date)}</div>
            {contract.category !== 'krankenkasse_grund' && (
              <div>
                Mindestlaufzeit {contract.min_term_months} Mt., Verlängerung {contract.renewal_months || 'unbefristet'}
                {contract.renewal_months ? ' Mt.' : ''}, Frist {contract.notice_months} Mt.
                {contract.to_month_end ? ' auf Monatsende' : ''}
              </div>
            )}
          </dl>
          {contract.notes && <p className="small">{contract.notes}</p>}
          <div className="actions">
            <Link className="button secondary" href={`/vertraege/${contract.id}/bearbeiten`}>Bearbeiten</Link>
            {active ? (
              <>
                <Link className="button" href={`/vertraege/${contract.id}/kuendigung`}>Kündigungsbrief</Link>
                <form action={markCancelled.bind(null, contract.id)} className="inline-form">
                  <button type="submit" className="secondary">Als gekündigt markieren</button>
                </form>
              </>
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

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Wechsel prüfen</h2>
          {contract.category === 'krankenkasse_grund' ? (
            <>
              <p>
                In der Grundversicherung sind die Leistungen bei allen Kassen gleich; es zählt nur die Prämie. Vergleichen
                Sie neutral mit dem offiziellen Prämienrechner des Bundes:{' '}
                <a href="https://www.priminfo.admin.ch" target="_blank" rel="noreferrer">priminfo.admin.ch</a>.
              </p>
              <p className="muted small">
                Abo-Pilot erhält in der Grundversicherung keine Provision und gibt keine Daten an Krankenkassen weiter.
              </p>
            </>
          ) : stage === 2 ? (
            <p className="muted">Versicherungsvergleiche folgen in einer späteren Version. Wir überwachen bis dahin Ihre Frist.</p>
          ) : view.offers.length === 0 ? (
            <p className="muted">Für diese Kategorie haben wir noch keine Angebote. Wir überwachen Ihre Frist.</p>
          ) : (
            <p className="small muted">
              Nettonutzen über {HORIZON_MONTHS} Monate = heutige Kosten − neue Kosten + Prämie − Einmalkosten. Sortiert
              nur nach Ihrem Nutzen; unsere Provision ist offen ausgewiesen und hat keinen Einfluss.
            </p>
          )}
        </section>
      </div>

      {view.offers.length > 0 && stage === 1 && (
        <>
          <h2>Angebote nach Nettonutzen</h2>
          <p className="notice small">
            Beispieldaten: Die Angebote sind fiktiv und dienen zum Testen. Vor dem Livegang ersetzen wir sie durch geprüfte
            Partnerdaten mit Quelle und Stichtag.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Angebot</th>
                  <th className="num">Kosten 24 Mt.</th>
                  <th className="num">Prämie</th>
                  <th className="num">Einmalig</th>
                  <th className="num">Nettonutzen</th>
                  <th className="num">Provision an uns</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.offers.map((r) => (
                  <tr key={r.offer.id}>
                    <td>
                      <strong>{r.offer.provider}</strong>
                      <div className="muted small">
                        {r.offer.name} · {formatChf(r.offer.monthlyPrice)}/Mt.
                        {r.offer.promoPrice !== null && r.offer.promoMonths > 0 && `, ${r.offer.promoMonths} Mt. à ${formatChf(r.offer.promoPrice)}`}
                      </div>
                      {r.ineligibleReason && <div className="small error">{r.ineligibleReason}</div>}
                    </td>
                    <td className="num">{formatChf(r.offerCost)}</td>
                    <td className="num">{formatChf(r.bonus)}</td>
                    <td className="num">{formatChf(r.oneTimeFee)}</td>
                    <td className="num">
                      <span className={r.netBenefit > 0 ? 'pos' : 'neg'}>{r.netBenefit > 0 ? '+' : ''}{formatChf(r.netBenefit)}</span>
                    </td>
                    <td className="num muted">{formatChf(r.offer.commissionChf)}</td>
                    <td>
                      {active && r.netBenefit > 0 && (
                        <form action={recordSwitch.bind(null, contract.id, r.offer.id)} className="inline-form">
                          <button type="submit" className="secondary">Wechsel vormerken</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Heutige Kosten über 24 Monate: {formatChf(view.offers[0].currentCost)}.</p>
        </>
      )}
    </>
  );
}
