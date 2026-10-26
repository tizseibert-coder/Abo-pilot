import { DeleteAccountForm } from '@/components/DeleteAccountForm';
import { requireUser } from '@/lib/auth';
import { formatCH } from '@/lib/dates';
import { saveProfile } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Account({ searchParams }: { searchParams: Promise<{ gespeichert?: string }> }) {
  const user = await requireUser();
  const { gespeichert } = await searchParams;
  return (
    <>
      <h1>Konto</h1>
      <p className="lead">{user.email} · seit {formatCH(user.created_at.slice(0, 10))}</p>
      {gespeichert && <p className="notice">Gespeichert.</p>}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Absender für Kündigungsbriefe</h2>
        <form action={saveProfile} className="stack">
          <label>Vorname Name<input name="name" defaultValue={user.name} autoComplete="name" /></label>
          <div className="row">
            <label>Strasse Nr.<input name="street" defaultValue={user.street} autoComplete="street-address" /></label>
            <label>PLZ Ort<input name="zip_city" defaultValue={user.zip_city} placeholder="8000 Zürich" /></label>
          </div>
          <div className="actions"><button type="submit">Speichern</button></div>
        </form>
      </section>

      <h2>Ihre Daten</h2>
      <div className="grid cols-2">
        <section className="card">
          <strong>Daten herunterladen</strong>
          <p className="small muted">Alle Verträge, Wechsel und Profildaten als JSON (Recht auf Auskunft und Datenherausgabe, Art. 25 und 28 DSG).</p>
          <a className="button secondary" href="/api/export">Export herunterladen</a>
        </section>
        <section className="card">
          <strong>Konto löschen</strong>
          <p className="small muted">Löscht Konto, Verträge und Wechsel sofort und endgültig.</p>
          <DeleteAccountForm />
        </section>
      </div>
    </>
  );
}
