import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthForms';
import { Icon } from '@/components/Icon';
import { currentUser } from '@/lib/auth';

export default async function Home({ searchParams }: { searchParams: Promise<{ geloescht?: string }> }) {
  if (await currentUser()) redirect('/dashboard');
  const { geloescht } = await searchParams;
  return (
    <>
      {geloescht && <p className="notice good">Ihr Konto und alle Daten wurden gelöscht.</p>}
      <section className="landing-hero">
        <div>
          <span className="eyebrow"><Icon name="shield" /> Neutral · Daten in der Schweiz</span>
          <h1>Ihre Abos im Griff. Jede Frist im Blick.</h1>
          <p className="lead">
            Abo-Pilot sammelt Handy, Internet, Krankenkasse und Streaming an einem Ort, erinnert vor jeder
            Kündigungsfrist und zeigt, welcher Wechsel sich über 24 Monate wirklich lohnt.
          </p>
          <ul className="trust-list">
            <li><Icon name="check" /> Sortiert nach Ihrem Vorteil, nie nach unserer Provision</li>
            <li><Icon name="check" /> Krankenkasse mit den offiziellen Prämien des Bundes</li>
            <li><Icon name="check" /> Sie entscheiden – wir bereiten Kündigung und Wechsel vor</li>
          </ul>
        </div>
        <AuthCard />
      </section>

      <section className="features">
        <div className="card feature">
          <div className="icon"><Icon name="sparkle" /></div>
          <h3>In 2 Minuten erfasst</h3>
          <p>Drei Fragen beantworten oder eine Rechnung einfügen. Anbieter, Preis und Frist erkennen wir selbst.</p>
        </div>
        <div className="card feature">
          <div className="icon"><Icon name="clock" /></div>
          <h3>Nie mehr zu spät</h3>
          <p>Erinnerung 60, 30 und 7 Tage vor jeder Frist – auch direkt in Ihrem Kalender.</p>
        </div>
        <div className="card feature">
          <div className="icon"><Icon name="scale" /></div>
          <h3>Ehrlich verglichen</h3>
          <p>Nettonutzen nach Aktionen, Prämien und Gebühren. Jede Provision legen wir offen.</p>
        </div>
      </section>

      <p className="footer-note">
        <Icon name="lock" /> Abo-Pilot ist ein Informationsdienst, keine Versicherungsvermittlerin. Ihre Daten werden nie verkauft.
      </p>
    </>
  );
}
