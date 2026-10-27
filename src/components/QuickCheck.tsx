'use client';

import { useActionState, useState } from 'react';
import { quickAddContract, type FormState } from '@/app/actions';
import { PROVIDER_SUGGESTIONS } from '@/data/providers';
import { CATEGORIES, DEFAULT_TERMS, type Category } from '@/lib/categories';
import { Icon, type IconName } from './Icon';

const QUICK: { key: Category; label: string; icon: IconName }[] = [
  { key: 'mobile', label: 'Handy', icon: 'sparkle' },
  { key: 'internet', label: 'Internet / TV', icon: 'database' },
  { key: 'krankenkasse_grund', label: 'Krankenkasse', icon: 'heart' },
  { key: 'streaming', label: 'Streaming', icon: 'calendar' },
  { key: 'bank', label: 'Bank', icon: 'lock' },
  { key: 'versicherung_sach', label: 'Versicherung', icon: 'shield' },
];

const TERMS = [
  { months: 0, label: 'Keine / weiss nicht' },
  { months: 12, label: '12 Monate' },
  { months: 24, label: '24 Monate' },
];

/** Vertrag in drei Angaben erfassen: Was, bei wem, wie viel. Alles andere ist optional. */
export function QuickCheckForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(quickAddContract, {});
  const [category, setCategory] = useState<Category>('mobile');
  const [provider, setProvider] = useState('');
  const [term, setTerm] = useState<number>(DEFAULT_TERMS.mobile.minTermMonths);
  const suggestions = PROVIDER_SUGGESTIONS[category];
  const showTerm = category !== 'krankenkasse_grund' && category !== 'streaming' && category !== 'bank';

  return (
    <form action={action} className="stack" style={{ gap: 22 }}>
      <div>
        <p className="label-title">1. Was für ein Vertrag?</p>
        <div className="chips">
          {QUICK.map((q) => (
            <label key={q.key} className="chip">
              <input
                type="radio"
                name="category"
                value={q.key}
                checked={category === q.key}
                onChange={() => {
                  setCategory(q.key);
                  setProvider('');
                  setTerm(DEFAULT_TERMS[q.key].minTermMonths);
                }}
              />
              <Icon name={q.icon} /> {q.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="label-title">2. Bei wem?</p>
        {suggestions.length > 0 && (
          <div className="chips" style={{ marginBottom: 10 }}>
            {suggestions.slice(0, 8).map((s) => (
              <button key={s} type="button" className={`chip-btn ${provider === s ? 'on' : ''}`} onClick={() => setProvider(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <input name="provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="oder Namen eintippen" list="provider-list" aria-label="Anbieter" required />
        <datalist id="provider-list">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="row">
        <label>
          3. Was zahlen Sie pro Monat?
          <input name="monthly_price" inputMode="decimal" placeholder="z. B. 49.90" required />
          <span className="hint">{category === 'krankenkasse_grund' ? 'Prämie pro Monat, für alle Personen zusammen' : 'Betrag in CHF, wie auf der Rechnung'}</span>
        </label>
        <label>
          Seit wann? <span className="hint">optional</span>
          <input name="since" type="month" />
        </label>
      </div>

      {showTerm && (
        <div>
          <p className="label-title">Mindestlaufzeit <span className="hint">optional – genauer ist besser</span></p>
          <div className="chips">
            {TERMS.map((t) => (
              <label key={t.months} className="chip">
                <input type="radio" name="min_term_months" value={t.months} checked={term === t.months} onChange={() => setTerm(t.months)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {!showTerm && <input type="hidden" name="min_term_months" value={DEFAULT_TERMS[category].minTermMonths} />}

      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <button type="submit" className="lg" disabled={pending}>
          Prüfen: Frist und Sparpotenzial <Icon name="arrowRight" />
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Kündigungsfrist setzen wir für {CATEGORIES[category].label} auf einen üblichen Wert. Sie können ihn jederzeit anpassen.
      </p>
    </form>
  );
}

export function NewContractTabs({ quick, detailed }: { quick: React.ReactNode; detailed: React.ReactNode }) {
  const [tab, setTab] = useState<'quick' | 'detailed'>('quick');
  return (
    <>
      <div className="tabs" role="tablist" style={{ maxWidth: 520 }}>
        <button type="button" role="tab" aria-selected={tab === 'quick'} onClick={() => setTab('quick')}>Schnell-Check · 30 Sek.</button>
        <button type="button" role="tab" aria-selected={tab === 'detailed'} onClick={() => setTab('detailed')}>Rechnung / alle Details</button>
      </div>
      {tab === 'quick' ? <section className="card">{quick}</section> : detailed}
    </>
  );
}
