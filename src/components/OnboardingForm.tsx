'use client';

import { useActionState } from 'react';
import { saveOnboarding, type FormState } from '@/app/actions';
import { INTERNET_NEED, MOBILE_USAGE, ROAMING, type Profile } from '@/lib/profile';

function Choice<T extends string>({ name, options, value }: { name: string; options: Record<T, { label: string; hint: string }>; value: T }) {
  return (
    <div className="choices">
      {(Object.entries(options) as [T, { label: string; hint: string }][]).map(([key, o]) => (
        <label key={key} className="choice">
          <input type="radio" name={name} value={key} defaultChecked={key === value} />
          <span>
            <strong>{o.label}</strong>
            {o.hint && <span className="hint">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

const QUICK = [
  { key: 'mobile', label: 'Handy-Abo', providerHint: 'z. B. Swisscom', priceHint: 'pro Handy' },
  { key: 'internet', label: 'Internet zu Hause', providerHint: 'z. B. Sunrise', priceHint: '' },
  { key: 'health', label: 'Krankenkasse (Grundversicherung)', providerHint: 'z. B. Helsana', priceHint: 'pro Person' },
  { key: 'streaming', label: 'Streaming', providerHint: 'z. B. Netflix', priceHint: '' },
];

export function OnboardingForm({ profile, hasContracts }: { profile: Profile; hasContracts: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOnboarding, {});
  return (
    <form action={action} className="stack" style={{ gap: 24 }}>
      <section className="card stack">
        <h2 style={{ margin: 0 }}><span className="step">1</span>Ihr Haushalt</h2>
        <div className="row">
          <label>
            Personen im Haushalt
            <input name="household_size" type="number" min={1} max={12} defaultValue={profile.householdSize} required />
          </label>
          <label>
            Anzahl Handys
            <input name="mobile_lines" type="number" min={0} max={12} defaultValue={profile.mobileLines} required />
          </label>
          <label>
            Postleitzahl <span className="hint">für Internet-Verfügbarkeit</span>
            <input name="plz" inputMode="numeric" maxLength={4} defaultValue={profile.plz} placeholder="8000" />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}><span className="step">2</span>So nutzen Sie Handy und Internet</h2>
        <div>
          <p className="label-title">Handy-Daten</p>
          <Choice name="mobile_usage" options={MOBILE_USAGE} value={profile.mobileUsage} />
        </div>
        <div>
          <p className="label-title">Unterwegs im Ausland</p>
          <Choice name="roaming" options={ROAMING} value={profile.roaming} />
        </div>
        <div>
          <p className="label-title">Internet zu Hause</p>
          <Choice name="internet_need" options={INTERNET_NEED} value={profile.internetNeed} />
        </div>
        <label className="check">
          <input name="wants_tv" type="checkbox" defaultChecked={profile.wantsTv} />
          <span>Ich möchte TV über das Internet-Abo</span>
        </label>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}><span className="step">3</span>Was zahlen Sie heute?</h2>
        <p className="muted small" style={{ margin: 0 }}>
          {hasContracts
            ? 'Für Kategorien, die Sie schon erfasst haben, legen wir nichts doppelt an.'
            : 'Ungefähre Beträge genügen. Leer lassen, was Sie nicht haben. Details können Sie später ergänzen.'}
        </p>
        {QUICK.map((q) => (
          <div key={q.key} className="row quick">
            <label>
              {q.label}
              <input name={`${q.key}_provider`} placeholder={q.providerHint} />
            </label>
            <label>
              CHF pro Monat {q.priceHint && <span className="hint">{q.priceHint}</span>}
              <input name={`${q.key}_price`} inputMode="decimal" placeholder="0.00" />
            </label>
          </div>
        ))}
      </section>

      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <button type="submit" className="lg" disabled={pending}>Fertig – meine Übersicht zeigen</button>
      </div>
    </form>
  );
}
