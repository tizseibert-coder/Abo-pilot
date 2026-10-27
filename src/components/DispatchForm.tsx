'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/actions';
import { Icon } from './Icon';

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function DispatchForm({
  action,
  defaults,
  provider,
  testMode,
}: {
  action: Action;
  defaults: { name: string; address: string; email: string };
  provider: string;
  testMode: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="stack">
      <div className="row">
        <label>
          Empfänger
          <input name="recipient_name" defaultValue={defaults.name} required />
        </label>
        <label>
          Kündigungs-E-Mail des Anbieters
          <input name="recipient_email" type="email" defaultValue={defaults.email} placeholder="z. B. kuendigung@anbieter.ch" />
          <span className="hint">Hierhin geht das signierte Original.</span>
        </label>
      </div>
      <label>
        Postadresse des Anbieters <span className="hint">für die eingeschriebene Kopie – eine Zeile pro Adresszeile</span>
        <textarea name="recipient_address" defaultValue={defaults.address} placeholder={'Kundendienst\nPostfach\n3050 Bern'} style={{ minHeight: 90 }} />
      </label>
      <label className="check">
        <input type="checkbox" name="with_post" defaultChecked={Boolean(defaults.address)} />
        <span>Zusätzlich eingeschrieben per Post senden (Zustellnachweis)</span>
      </label>
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>
          Ich beauftrage Abo-Pilot, meine Kündigung an {provider} zu übermitteln, nachdem ich sie selbst unterschrieben habe.
        </span>
      </label>
      {testMode && (
        <p className="notice small" style={{ margin: 0 }}>
          Testbetrieb: Unterschrift, E-Mail und Post werden nur simuliert. Für den Echtbetrieb Skribble, SMTP und Pingen konfigurieren.
        </p>
      )}
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <button type="submit" className="lg" disabled={pending}>
          <Icon name="lock" /> Unterschreiben mit QES
        </button>
      </div>
    </form>
  );
}
