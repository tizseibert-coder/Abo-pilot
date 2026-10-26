'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, register, type FormState } from '@/app/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="stack">
      <label>
        E-Mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Passwort
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>Anmelden</button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  return (
    <form action={action} className="stack">
      <label>
        Name
        <input name="name" autoComplete="name" />
      </label>
      <label>
        E-Mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Passwort <span className="hint">mindestens 10 Zeichen</span>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label className="check">
        <input name="consent" type="checkbox" required />
        <span>
          Ich akzeptiere die <Link href="/agb">Nutzungsbedingungen</Link> und habe die{' '}
          <Link href="/datenschutz">Datenschutzerklärung</Link> gelesen.
        </span>
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>Kostenlos registrieren</button>
    </form>
  );
}
