import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DirectoryForm } from '@/components/DirectoryForm';
import { requireUser } from '@/lib/auth';
import { categoryLabel } from '@/lib/categories';
import { isAdmin } from '@/lib/context';
import { formatCH } from '@/lib/dates';
import { listDirectory } from '@/lib/dispatch/directory';
import { removeDirectory, saveDirectoryAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function DirectoryAdmin({ searchParams }: { searchParams: Promise<{ bearbeiten?: string; neu?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const sp = await searchParams;
  const entries = listDirectory();
  const editing = sp.bearbeiten ? entries.find((e) => e.id === Number(sp.bearbeiten)) : undefined;
  return (
    <>
      <h1>Kündigungsadressen</h1>
      <p className="lead">
        Damit Kundinnen und Kunden nichts suchen müssen: E-Mail und Postadresse für Kündigungen pro Anbieter, immer mit Quelle
        (AGB oder Kontaktseite). Nie raten – eine falsche Adresse kann eine Frist kosten.
      </p>
      {(editing || sp.neu) && (
        <section className="card" style={{ margin: '16px 0' }}>
          <DirectoryForm action={saveDirectoryAction.bind(null, editing?.id ?? null)} d={editing} />
          <p className="small"><Link href="/admin/adressen">Abbrechen</Link></p>
        </section>
      )}
      <div className="actions" style={{ margin: '16px 0' }}><Link className="button" href="/admin/adressen?neu=1">Neue Adresse</Link></div>
      {entries.length === 0 ? (
        <p className="muted">Noch keine Einträge.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Anbieter</th><th>E-Mail</th><th>Post</th><th>Geprüft</th><th></th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.provider}</strong><div className="small muted">{e.category ? categoryLabel(e.category) : 'alle Kategorien'}</div></td>
                  <td className="small">{e.cancel_email || '–'}</td>
                  <td className="small" style={{ whiteSpace: 'pre-line' }}>{e.postal_address || '–'}</td>
                  <td className="small">{formatCH(e.checked_at)} · <a href={e.source_url} target="_blank" rel="noreferrer">Quelle</a></td>
                  <td>
                    <div className="actions">
                      <Link className="button secondary" href={`/admin/adressen?bearbeiten=${e.id}`}>Bearbeiten</Link>
                      <form action={removeDirectory.bind(null, e.id)} className="inline-form"><button type="submit" className="link">Löschen</button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
