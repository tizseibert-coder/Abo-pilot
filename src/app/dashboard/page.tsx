import Link from 'next/link';
import { Avatar, Icon, type IconName } from '@/components/Icon';
import { requireUser } from '@/lib/auth';
import { formatChf, savingsWindow } from '@/lib/benefit';
import { reviewDue } from '@/lib/review';
import { categoryLabel } from '@/lib/categories';
import { offerContext } from '@/lib/context';
import { addDays, diffDays, formatCH, parseISO, toISO, today } from '@/lib/dates';
import { URGENCY_LABEL } from '@/lib/deadlines';
import { buildOverview, type ContractView } from '@/lib/overview';
import { getProfile, listContracts, listSwitches } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Task {
  key: string;
  tone: 'late' | 'warn' | 'info' | 'good';
  icon: IconName;
  title: string;
  text: string;
  href: string;
  cta: string;
}

function greeting(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Grüezi ${first}` : 'Übersicht';
}

function buildTasks(views: ContractView[], hasProfile: boolean, todayISO: string): Task[] {
  const tasks: Task[] = [];
  const year = todayISO.slice(0, 4);
  const healthDeadline = `${year}-11-30`;
  if (todayISO.slice(5, 7) >= '09' && todayISO <= healthDeadline) {
    const days = diffDays(parseISO(todayISO), parseISO(healthDeadline));
    tasks.push({
      key: 'kk',
      tone: days <= 14 ? 'late' : 'warn',
      icon: 'heart',
      title: `Krankenkasse: noch ${days} Tage bis zur Kündigungsfrist`,
      text: 'Kündigung muss bis 30.11. eintreffen. Vergleich mit den offiziellen Prämien, ohne Provision.',
      href: '/krankenkasse',
      cta: 'Prämien vergleichen',
    });
  }
  if (!hasProfile) {
    tasks.push({ key: 'profil', tone: 'info', icon: 'sliders', title: 'Profil ergänzen', text: 'Damit wir nur Angebote zeigen, die zu Ihrer Nutzung passen.', href: '/start', cta: 'Profil ausfüllen' });
  }
  for (const v of views) {
    const id = v.contract.id;
    if (reviewDue(v.contract.review_on, todayISO) && v.urgency !== 'rot') {
      tasks.push({
        key: `review-${id}`,
        tone: v.best ? 'good' : 'info',
        icon: 'calendar',
        title: `${v.contract.provider}: Überprüfung fällig`,
        text: v.best ? `Ein Wechsel spart ${formatChf(v.best.netBenefit)} in 24 Monaten.` : 'Preis und Bedingungen kurz bestätigen – ein Klick.',
        href: `/vertraege/${id}`,
        cta: 'Jetzt prüfen',
      });
      continue;
    }
    if (v.contract.category === 'krankenkasse_grund') continue;
    if (v.urgency === 'rot' || v.urgency === 'orange' || v.urgency === 'gelb') {
      tasks.push({
        key: `frist-${id}`,
        tone: v.urgency === 'rot' ? 'late' : 'warn',
        icon: 'clock',
        title: `${v.contract.provider}: kündigen bis ${formatCH(v.deadline.deadline)}`,
        text: v.best ? `Noch ${v.deadline.daysLeft} Tage. Bester Wechsel spart ${formatChf(v.best.netBenefit)} in 24 Monaten.` : `Noch ${v.deadline.daysLeft} Tage, sonst verlängert sich der Vertrag.`,
        href: `/vertraege/${id}`,
        cta: 'Ansehen',
      });
    } else if (v.best && v.best.netBenefit >= 50) {
      tasks.push({
        key: `spar-${id}`,
        tone: 'good',
        icon: 'tag',
        title: `${v.contract.provider}: ${formatChf(v.best.netBenefit)} sparen`,
        text: `${v.best.offer.provider} ${v.best.offer.name} passt zu Ihrem Profil. Wechsel ${v.deadline.kind === 'unbefristet' ? 'jederzeit' : `per ${formatCH(v.deadline.endDate)}`} möglich.`,
        href: `/vertraege/${id}/wechseln?angebot=${encodeURIComponent(v.best.offer.id)}`,
        cta: 'Wechsel prüfen',
      });
    }
  }
  const order = { late: 0, warn: 1, good: 2, info: 3 };
  return tasks.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ willkommen?: string }> }) {
  const user = await requireUser();
  const { willkommen } = await searchParams;
  const todayISO = today();
  const hasProfile = getProfile(user.id) !== null;
  const { views, monthlyTotal, potential, inactive } = buildOverview(listContracts(user.id), listSwitches(user.id), todayISO, offerContext(user.id));
  const tasks = buildTasks(views, hasProfile, todayISO);
  const next = views.filter((v) => v.deadline.kind !== 'unbefristet').sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft)[0];
  const firstYear = views.reduce(
    (sum, v) => sum + (v.best ? savingsWindow(v.contract.monthly_price, v.best, toISO(addDays(parseISO(v.deadline.endDate), 1))).firstYear : 0),
    0,
  );
  const assumed = views.filter((v) => v.contract.notes.includes('Profil-Assistenten') || v.deadline.note.includes('fehlt')).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting(user.name)}</h1>
          <p>Stand {formatCH(todayISO)} · {views.length} aktive Verträge</p>
        </div>
        <div className="actions">
          <a className="button secondary" href="/api/kalender"><Icon name="calendar" /> In Kalender</a>
          <Link className="button" href="/vertraege/neu"><Icon name="plus" /> Vertrag erfassen</Link>
        </div>
      </div>

      {willkommen && (
        <p className="notice info" style={{ marginBottom: 20 }}>
          Profil gespeichert. Laufzeiten der neuen Verträge sind Annahmen – öffnen Sie einen Vertrag, um Beginn und Frist zu ergänzen.
        </p>
      )}

      <section className="bento">
        <div className="card kpi hero">
          <span className="label"><Icon name="tag" /> Sparpotenzial</span>
          <span className="value">{formatChf(potential)}</span>
          <span className="sub">über 24 Monate · davon {formatChf(firstYear)} im ersten Jahr nach dem Wechsel</span>
        </div>
        <div className="card kpi">
          <span className="label"><Icon name="calendar" /> Fixkosten</span>
          <span className="value">{formatChf(monthlyTotal)}</span>
          <span className="sub">pro Monat · {formatChf(monthlyTotal * 12)} im Jahr</span>
        </div>
        <div className="card kpi">
          <span className="label"><Icon name="clock" /> Nächste Frist</span>
          {next ? (
            <>
              <span className="value">{next.deadline.daysLeft} Tage</span>
              <span className="sub">{next.contract.provider} · bis {formatCH(next.deadline.deadline)}</span>
            </>
          ) : (
            <>
              <span className="value">–</span>
              <span className="sub">keine befristeten Verträge</span>
            </>
          )}
        </div>
      </section>

      <p className="free-note" style={{ marginTop: -12, marginBottom: 24 }}>
        <Icon name="check" />
        <span>
          Für Sie kostenlos: Nehmen Sie ein Angebot an, zahlt der Anbieter uns eine offen ausgewiesene Provision. Ihr Preis bleibt
          gleich, und bei der Krankenkasse verdienen wir gar nichts.
        </span>
      </p>

      {tasks.length > 0 && (
        <>
          <h2>Jetzt erledigen</h2>
          <div className="tasks">
            {tasks.map((t) => (
              <div key={t.key} className={`task ${t.tone}`}>
                <span className="dot"><Icon name={t.icon} /></span>
                <div className="body">
                  <strong>{t.title}</strong>
                  <span>{t.text}</span>
                </div>
                <Link className={`button ${t.tone === 'good' ? 'good' : t.tone === 'info' ? 'secondary' : ''}`} href={t.href}>
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card-title" style={{ marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>Ihre Verträge</h2>
        {assumed > 0 && <span className="small muted">{assumed} mit geschätzten Laufzeiten</span>}
      </div>
      {views.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h3>Noch keine Verträge</h3>
          <p className="muted">Am schnellsten geht es mit drei Fragen zu Ihrem Haushalt.</p>
          <Link className="button lg" href="/start">Profil-Assistent starten</Link>
        </div>
      ) : (
        <div className="list">
          {views.map((v) => (
            <Link key={v.contract.id} href={`/vertraege/${v.contract.id}`} className="list-row">
              <Avatar name={v.contract.provider} />
              <div style={{ minWidth: 0 }}>
                <div className="title">{v.contract.provider}</div>
                <div className="meta">{categoryLabel(v.contract.category)}{v.contract.product && ` · ${v.contract.product}`}</div>
              </div>
              <div className="col-price tabular">
                <strong>{v.contract.monthly_price.toFixed(2)}</strong>
                <div className="meta">CHF / Mt.</div>
              </div>
              <div className="col-deadline">
                <span className={`badge ${v.urgency}`}>
                  {v.deadline.kind === 'unbefristet' ? URGENCY_LABEL.frei : `bis ${formatCH(v.deadline.deadline)}`}
                </span>
              </div>
              <div className="col-save right">
                {v.best ? (
                  <>
                    <span className="pos">+{formatChf(v.best.netBenefit)}</span>
                    <div className="meta">mit {v.best.offer.provider}</div>
                  </>
                ) : (
                  <span className="meta">kein besseres Angebot</span>
                )}
              </div>
              <span className="chev"><Icon name="chevron" /></span>
            </Link>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <details style={{ marginTop: 24 }}>
          <summary className="muted">Gekündigt oder beendet ({inactive.length})</summary>
          <div className="list" style={{ marginTop: 12 }}>
            {inactive.map((c) => (
              <Link key={c.id} href={`/vertraege/${c.id}`} className="list-row">
                <Avatar name={c.provider} />
                <div>
                  <div className="title">{c.provider}</div>
                  <div className="meta">{c.status}{c.ended_on && ` per ${formatCH(c.ended_on)}`}</div>
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
