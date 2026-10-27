import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { isAdmin } from '@/lib/context';
import { getDb } from '@/lib/db';
import { letterService, mailer, signatureProvider } from '@/lib/dispatch/providers';

export const dynamic = 'force-dynamic';

export default async function Outbox() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const mails = getDb().prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 50').all() as {
    id: number; to_addr: string; cc_addr: string; subject: string; attachments: string; transport: string; created_at: string;
  }[];
  const letters = getDb().prepare('SELECT * FROM test_letters ORDER BY created_at DESC LIMIT 20').all() as { id: string; registered: number; bytes: number; created_at: string }[];
  return (
    <>
      <h1>Postausgang</h1>
      <p className="lead">
        Dienste: Signatur <strong>{signatureProvider().name}</strong> · E-Mail <strong>{mailer().name}</strong> · Post <strong>{letterService().name}</strong>.
        Im Testbetrieb landen E-Mails und Briefe nur hier.
      </p>
      <h2>E-Mails</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Zeit</th><th>An</th><th>Betreff</th><th>Anhang</th><th>Weg</th></tr></thead>
          <tbody>
            {mails.map((m) => (
              <tr key={m.id}>
                <td className="small">{m.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td className="small">{m.to_addr}{m.cc_addr && <div className="muted">cc {m.cc_addr}</div>}</td>
                <td className="small">{m.subject}</td>
                <td className="small">{m.attachments}</td>
                <td className="small">{m.transport}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Test-Briefe</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Zeit</th><th>ID</th><th>Einschreiben</th><th className="num">Grösse</th></tr></thead>
          <tbody>
            {letters.map((l) => (
              <tr key={l.id}><td className="small">{l.created_at.slice(0, 16).replace('T', ' ')}</td><td className="small">{l.id}</td><td>{l.registered ? 'ja' : 'nein'}</td><td className="num">{(l.bytes / 1024).toFixed(0)} KB</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
