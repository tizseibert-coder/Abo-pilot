'use client';

import { useActionState } from 'react';
import { deleteAccount, type FormState } from '@/app/actions';

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="stack">
      <label>
        Zur Bestätigung LÖSCHEN eingeben
        <input name="confirm" autoComplete="off" />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <button type="submit" disabled={pending}>Konto endgültig löschen</button>
      </div>
    </form>
  );
}
