import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { signTestDocument } from '../../../actions';

export const dynamic = 'force-dynamic';

/** Simulierter Signaturdienst für Entwicklung und Tests (ersetzt Skribble, solange SIGN_PROVIDER nicht gesetzt ist). */
export default async function TestSigning({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const row = getDb().prepare('SELECT title, signer_email, signed_pdf FROM test_signatures WHERE id = ?').get(id) as
    | { title: string; signer_email: string; signed_pdf: Uint8Array | null }
    | undefined;
  if (!row || row.signer_email !== user.email) notFound();
  return (
    <section className="card" style={{ maxWidth: 560, margin: '24px auto' }}>
      <span className="badge orange">Testbetrieb</span>
      <h1 style={{ marginTop: 12 }}>Dokument unterschreiben</h1>
      <p className="muted">{row.title}</p>
      <p className="small muted">
        Im Echtbetrieb öffnet sich hier Skribble: einmalige Identifikation, dann Unterschrift mit Code aufs Handy. Diese
        Testseite setzt nur einen sichtbaren, rechtlich ungültigen Vermerk.
      </p>
      <form action={signTestDocument.bind(null, id)}>
        <button type="submit" className="lg block"><Icon name="lock" /> Test-Unterschrift setzen</button>
      </form>
    </section>
  );
}
