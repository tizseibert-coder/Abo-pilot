import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SourceForm } from '@/components/DataImportForm';
import { requireUser } from '@/lib/auth';
import { categoryLabel } from '@/lib/categories';
import { isAdmin } from '@/lib/context';
import { getSource, listSources } from '@/lib/crawler/run';
import { formatCH } from '@/lib/dates';
import { removeSource, runAllSourcesNow, runSourceNow, saveSourceAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function SourcesAdmin({ searchParams }: { searchParams: Promise<{ bearbeiten?: string; neu?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const { bearbeiten, neu } = await searchParams;
  const sources = listSources();
  const editing = bearbeiten ? getSource(Number(bearbeiten)) : undefined;

  return (
    <>
      <h1>Angebotsquellen</h1>
      <p className="lead">
        Der Suchlauf liest einmal pro Tag die Tarifseiten der Anbieter. Neue oder geänderte Angebote landen als Entwurf in{' '}
        <Link href="/admin/angebote">Angebote pflegen</Link>; unveränderte, bereits geprüfte Angebote werden automatisch bestätigt.
      </p>
      <p className="notice small">
        Spielregeln: nur Seiten der Anbieter selbst (keine Vergleichsportale), robots.txt wird respektiert, der Bot gibt sich
        als «AboPilotBot» zu erkennen. Vor dem Aktivieren die Nutzungsbedingungen der Seite lesen. Besser ist ein Daten-Feed
        des Anbieters (CSV-Import).
      </p>

      {(editing || neu) && (
        <section className="card" style={{ margin: '16px 0' }}>
          <h2 style={{ marginTop: 0 }}>{editing ? `${editing.provider} bearbeiten` : 'Neue Quelle'}</h2>
          <SourceForm
            action={saveSourceAction.bind(null, editing?.id ?? null)}
            defaults={editing ? { category: editing.category, provider: editing.provider, url: editing.url, method: editing.method, active: editing.active === 1 } : undefined}
          />
          <p className="small"><Link href="/admin/quellen">Abbrechen</Link></p>
        </section>
      )}

      <div className="actions" style={{ margin: '16px 0' }}>
        <Link className="button secondary" href="/admin/quellen?neu=1">Neue Quelle</Link>
        <form action={runAllSourcesNow} className="inline-form">
          <button type="submit">Alle aktiven Quellen jetzt abrufen</button>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Quelle</th><th>Methode</th><th>Letzter Lauf</th><th>Ergebnis</th><th></th></tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.provider}</strong> <span className="muted small">{categoryLabel(s.category)}</span>
                  <div className="small"><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></div>
                  {s.active !== 1 && <span className="badge gelb">inaktiv</span>}
                </td>
                <td className="small">{s.method}</td>
                <td className="small">{s.last_run_at ? formatCH(s.last_run_at.slice(0, 10)) : '–'}</td>
                <td className="small">
                  {s.last_status && <span className={`badge ${s.last_status === 'ok' ? 'gruen' : 'rot'}`}>{s.last_status}</span>} {s.last_message}
                </td>
                <td>
                  <div className="actions">
                    <form action={runSourceNow.bind(null, s.id)} className="inline-form">
                      <button type="submit" className="secondary">Abrufen</button>
                    </form>
                    <Link className="button secondary" href={`/admin/quellen?bearbeiten=${s.id}`}>Bearbeiten</Link>
                    <form action={removeSource.bind(null, s.id)} className="inline-form">
                      <button type="submit" className="link">Löschen</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Täglicher Lauf: <code>POST /api/cron/angebote</code> mit Header <code>Authorization: Bearer $CRON_SECRET</code>, z. B. per
        Cronjob auf dem Server. Für Seiten ohne strukturierte Daten braucht es <code>ANTHROPIC_API_KEY</code>.
      </p>
    </>
  );
}
