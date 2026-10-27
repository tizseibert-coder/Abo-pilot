import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Avatar, Icon, type IconName } from '@/components/Icon';
import { requireUser } from '@/lib/auth';
import { formatChf, savingsWindow } from '@/lib/benefit';
import { categoryLabel } from '@/lib/categories';
import { offerContext } from '@/lib/context';
import { addDays, formatCH, parseISO, toISO, today } from '@/lib/dates';
import { historyOf, viewContract } from '@/lib/overview';
import { getContract, listContracts, listSwitches } from '@/lib/repo';
import { startSwitch } from '../../../actions';

export const dynamic = 'force-dynamic';

interface Check {
  tone: 'ok' | 'warn' | 'info';
  title: string;
  text: string;
}

const MARK: Record<Check['tone'], IconName> = { ok: 'check', warn: 'alert', info: 'clock' };

export default async function SwitchAssistant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ angebot?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const { angebot } = await searchParams;
  const contract = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!contract) notFound();
  if (contract.status !== 'aktiv') redirect(`/vertraege/${id}`);

  const todayISO = today();
  const view = viewContract(contract, historyOf(listContracts(user.id), listSwitches(user.id)), todayISO, offerContext(user.id));
  const r = view.offers.find((o) => o.offer.id === angebot) ?? view.best;
  if (!r) redirect(`/vertraege/${id}`);

  const d = view.deadline;
  const startNew = toISO(addDays(parseISO(d.endDate), 1));
  const win = savingsWindow(contract.monthly_price, r, startNew);

  const checks: Check[] = [
    {
      tone: d.daysLeft <= 7 && d.kind !== 'unbefristet' ? 'warn' : 'ok',
      title: `Kündigung bis ${formatCH(d.deadline)} beim Anbieter`,
      text:
        d.kind === 'unbefristet'
          ? `Jederzeit kündbar. Mit Frist endet der Vertrag am ${formatCH(d.endDate)}.`
          : `Noch ${d.daysLeft} Tage. Der Vertrag endet dann am ${formatCH(d.endDate)} – kein Rest der Mindestlaufzeit.`,
    },
    r.ineligibleReason
      ? { tone: 'warn', title: 'Sperrfrist: keine Neukunden-Prämie', text: `${r.ineligibleReason} Der Wechsel lohnt sich trotzdem um ${formatChf(r.netBenefit)}.` }
      : {
          tone: 'ok',
          title: 'Keine Sperrfrist im Weg',
          text: r.offer.newCustomerLockMonths > 0 ? `Sie waren in den letzten ${r.offer.newCustomerLockMonths} Monaten nicht Kunde bei ${r.offer.provider}.` : 'Das Angebot hat keine Neukunden-Bedingung.',
        },
    {
      tone: 'info',
      title: `Neuen Vertrag ab ${formatCH(startNew)} starten`,
      text: 'So zahlen Sie nie doppelt. Beim Abschluss das Startdatum angeben.',
    },
  ];
  if (r.offer.minTermMonths > 0) checks.push({ tone: 'info', title: `Neuer Vertrag: ${r.offer.minTermMonths} Monate Mindestlaufzeit`, text: 'Wir erinnern Sie rechtzeitig vor dem Ende.' });
  if (r.offer.validUntil) {
    checks.push({
      tone: r.offer.validUntil < todayISO ? 'warn' : 'info',
      title: `Aktion nur bis ${formatCH(r.offer.validUntil)} abschliessbar`,
      text: 'Abschliessen können Sie sofort – der Vertragsbeginn darf später sein.',
    });
  }
  if (contract.category === 'mobile') {
    checks.push({ tone: 'info', title: 'Rufnummer mitnehmen', text: 'Beim neuen Anbieter «Portierung» wählen. Er kümmert sich in der Regel um den Übertrag; die Kündigungsfrist beim alten Anbieter gilt trotzdem.' });
  }

  return (
    <>
      <Link href={`/vertraege/${contract.id}`} className="back"><Icon name="arrowLeft" /> {contract.provider}</Link>
      <div className="page-head">
        <div>
          <h1>Wechsel in 3 Schritten</h1>
          <p>Wir haben alles geprüft. Sie bestätigen – wir erstellen die Kündigung und überwachen die Prämie.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="compare">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar name={contract.provider} />
            <div>
              <div className="muted small">Heute</div>
              <strong>{contract.provider}</strong>
              <div className="muted small tabular">{formatChf(contract.monthly_price)} / Mt. · {categoryLabel(contract.category)}</div>
            </div>
          </div>
          <span className="arrow"><Icon name="arrowRight" /></span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar name={r.offer.provider} />
            <div>
              <div className="muted small">Neu ab {formatCH(startNew)}</div>
              <strong>{r.offer.provider} {r.offer.name}</strong>
              <div className="muted small tabular">
                {formatChf(r.offer.promoPrice ?? r.offer.monthlyPrice)} / Mt.
                {r.offer.promoPrice !== null && (r.offer.promoMonths >= 999 ? ' dauerhaft' : ` für ${r.offer.promoMonths} Mt., danach ${formatChf(r.offer.monthlyPrice)}`)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="savings" style={{ marginBottom: 16 }}>
        <div><div className="l">pro Monat (Schnitt)</div><div className="v">{formatChf(win.perMonth)}</div></div>
        <div><div className="l">im ersten Jahr</div><div className="v">{formatChf(win.firstYear)}</div></div>
        <div><div className="l">in 24 Monaten</div><div className="v">{formatChf(win.horizon)}</div></div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Unsere Prüfung</h3>
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.title} className={c.tone}>
              <span className="mark"><Icon name={MARK[c.tone]} /></span>
              <div><strong>{c.title}</strong><span className="txt">{c.text}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>So geht es weiter</h3>
        <ol className="small" style={{ paddingLeft: 18, color: 'var(--muted)' }}>
          <li>Wir erstellen Ihren Kündigungsbrief an {contract.provider} – Sie unterschreiben und senden ihn.</li>
          <li>Sie schliessen das neue Abo direkt bei {r.offer.provider} ab (Startdatum {formatCH(startNew)}).</li>
          <li>Wir erinnern Sie, falls eine Prämie nicht ankommt.</li>
        </ol>
        <div className="actions" style={{ marginTop: 12 }}>
          <form action={startSwitch.bind(null, contract.id, r.offer.id)} className="inline-form">
            <button type="submit" className="good lg">Wechsel starten <Icon name="arrowRight" /></button>
          </form>
          <a className="button secondary lg" href={r.offer.sourceUrl} target="_blank" rel="noreferrer">Angebot ansehen</a>
        </div>
        <p className="free-note" style={{ marginTop: 16 }}>
          <Icon name="check" />
          <span>
            Abo-Pilot ist für Sie kostenlos. Schliessen Sie über uns ab, zahlt {r.offer.provider} uns
            {r.offer.commissionChf > 0 ? ` eine Provision von ${formatChf(r.offer.commissionChf)}` : ' allenfalls eine Provision'} – Ihr Preis bleibt gleich,
            und die Reihenfolge der Angebote hängt nie davon ab.
          </span>
        </p>
      </section>
    </>
  );
}
