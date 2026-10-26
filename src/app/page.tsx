import { redirect } from 'next/navigation';
import { LoginForm, RegisterForm } from '@/components/AuthForms';
import { currentUser } from '@/lib/auth';

export default async function Home({ searchParams }: { searchParams: Promise<{ geloescht?: string }> }) {
  if (await currentUser()) redirect('/dashboard');
  const { geloescht } = await searchParams;
  return (
    <>
      {geloescht && <p className="notice">Ihr Konto und alle Daten wurden gelöscht.</p>}
      <h1>Nie mehr eine Kündigungsfrist verpassen.</h1>
      <p className="lead">
        Abo-Pilot erfasst Ihre Verträge, rechnet jede Frist aus und zeigt neutral, welcher Wechsel sich über 24 Monate
        wirklich lohnt. Sortiert nach Ihrem Nutzen, nicht nach unserer Provision.
      </p>
      <div className="grid cols-3" style={{ margin: '24px 0' }}>
        <div className="card"><strong>1. Erfassen</strong><p className="muted small">Rechnung einfügen oder PDF hochladen. Anbieter, Preis und Nummer werden erkannt.</p></div>
        <div className="card"><strong>2. Fristen sehen</strong><p className="muted small">Ampel und Kalender-Erinnerung 60, 30 und 7 Tage vor jeder Frist.</p></div>
        <div className="card"><strong>3. Wechseln</strong><p className="muted small">Nettonutzen, Kündigungsbrief zum Unterschreiben, Prämien-Tracker.</p></div>
      </div>
      <div className="grid cols-2">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Konto erstellen</h2>
          <RegisterForm />
        </section>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Anmelden</h2>
          <LoginForm />
        </section>
      </div>
      <p className="muted small" style={{ marginTop: 24 }}>
        Daten werden in der Schweiz gespeichert und nie verkauft. Abo-Pilot ist ein Informationsdienst und keine
        Versicherungsvermittlerin.
      </p>
    </>
  );
}
