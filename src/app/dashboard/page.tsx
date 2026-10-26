import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatChf } from '@/lib/benefit';
import { categoryLabel } from '@/lib/categories';
import { formatCH, today } from '@/lib/dates';
import { URGENCY_LABEL } from '@/lib/deadlines';
import { offerContext } from '@/lib/context';
import { buildOverview } from '@/lib/overview';
import { getProfile, listContracts, listSwitches } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ willkommen?: string }> }) {
  const user = await requireUser();
  const { willkommen } = await searchParams;
  const todayISO = today();
  const hasProfile = getProfile(user.id) !== null;
  const { views, monthlyTotal, potential, inactive } = buildOverview(listContracts(user.id), listSwitches(user.id), todayISO, offerContext(user.id));
  const month = Number(todayISO.slice(5, 7));
  const healthSeason = month >= 9 && todayISO <= `${todayISO.slice(0, 4)}-11-30`;
  const hasHealth = views.some((v) => v.contract.category === 'krankenkasse_grund');

  return (
    <>
      <h1>Übersicht</h1>
      <p className="lead">Stand {formatCH(todayISO)}. Dringende Fristen stehen oben.</p>

      {willkommen && (
        <p className="notice">
          Profil gespeichert. Laufzeiten und Fristen der neu angelegten Verträge sind Annahmen: Öffnen Sie einen Vertrag
          und ergänzen Sie Beginn und Frist, oder fügen Sie eine Rechnung ein.
        </p>
      )}
      {!hasProfile && (
        <p className="notice">
          <strong>Noch 2 Minuten:</strong> <Link href="/start">Profil ausfüllen</Link>, damit wir nur Angebote zeigen, die zu
          Ihrer Nutzung passen.
        </p>
      )}

      {healthSeason && (
        <p className="notice">
          <strong>Krankenkassen-Check:</strong> Die Kündigung der Grundversicherung muss bis 30.11. beim Versicherer
          eintreffen. <Link href="/krankenkasse">Jetzt Prämien vergleichen</Link> – mit den offiziellen Zahlen des BAG, ohne
          Provision.
          {!hasHealth && ' Erfassen Sie Ihre Krankenkasse, damit wir die Frist überwachen.'}
        </p>
      )}

      <div className="grid cols-3" style={{ margin: '16px 0' }}>
        <div className="card stat"><div className="value">{views.length}</div><div className="label">aktive Verträge</div></div>
        <div className="card stat"><div className="value">{formatChf(monthlyTotal)}</div><div className="label">Kosten pro Monat</div></div>
        <div className="card stat"><div className="value">{formatChf(potential)}</div><div className="label">Sparpotenzial über 24 Monate</div></div>
      </div>

      <div className="actions" style={{ marginBottom: 16 }}>
        <Link className="button" href="/vertraege/neu">Vertrag erfassen</Link>
        <a className="button secondary" href="/api/kalender">Fristen in Kalender (.ics)</a>
      </div>

      {views.length === 0 ? (
        <div className="card">
          <p>
            Noch keine Verträge erfasst. Am schnellsten geht es mit dem <Link href="/start">Profil-Assistenten</Link>.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vertrag</th>
                <th className="num">CHF / Monat</th>
                <th>Kündigung bis</th>
                <th>Status</th>
                <th className="num">Bester Wechsel (24 Mt.)</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.contract.id}>
                  <td>
                    <Link href={`/vertraege/${v.contract.id}`}><strong>{v.contract.provider}</strong></Link>
                    <div className="muted small">{categoryLabel(v.contract.category)}{v.contract.product && ` · ${v.contract.product}`}</div>
                  </td>
                  <td className="num">{v.contract.monthly_price.toFixed(2)}</td>
                  <td>
                    {v.deadline.kind === 'unbefristet' ? (
                      <span className="muted">jederzeit</span>
                    ) : (
                      <>
                        {formatCH(v.deadline.deadline)}
                        <div className="muted small">noch {v.deadline.daysLeft} Tage, Ende {formatCH(v.deadline.endDate)}</div>
                      </>
                    )}
                  </td>
                  <td><span className={`badge ${v.urgency}`}>{URGENCY_LABEL[v.urgency]}</span></td>
                  <td className="num">
                    {v.best ? <span className="pos">+{formatChf(v.best.netBenefit)}</span> : <span className="neg">–</span>}
                    {v.best && <div className="muted small">{v.best.offer.provider}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inactive.length > 0 && (
        <>
          <h2>Gekündigt oder beendet</h2>
          <ul>
            {inactive.map((c) => (
              <li key={c.id}>
                <Link href={`/vertraege/${c.id}`}>{c.provider}</Link>{' '}
                <span className="muted small">{c.status}{c.ended_on && ` per ${formatCH(c.ended_on)}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
