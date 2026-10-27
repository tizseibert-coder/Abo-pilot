'use client';

import { useActionState } from 'react';
import { startKkSwitch, type FormState } from '@/app/actions';

/** Umschliesst die Vergleichstabelle: jeder «Wechseln»-Knopf schickt seine Kasse mit. */
export function KkSwitchForm({ needsCurrent, children }: { needsCurrent: boolean; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startKkSwitch, {});
  return (
    <form action={action} aria-busy={pending}>
      {needsCurrent && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="label-title">Für die Kündigung: Wo sind Sie heute versichert?</p>
          <div className="row">
            <label>Heutige Krankenkasse<input name="current_provider" placeholder="z. B. Helsana" /></label>
            <label>Heutige Prämie CHF / Monat <span className="hint">optional</span><input name="current_price" inputMode="decimal" /></label>
          </div>
        </div>
      )}
      {state.error && <p className="error">{state.error}</p>}
      {children}
    </form>
  );
}
