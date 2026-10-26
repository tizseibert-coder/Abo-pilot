'use client';

import { useActionState, useState } from 'react';
import type { FormState } from '@/app/actions';
import { CATEGORIES, DEFAULT_TERMS, isCategory, type Category } from '@/lib/categories';

export interface ContractDefaults {
  category: string;
  provider: string;
  product: string;
  customer_number: string;
  monthly_price: string;
  start_date: string;
  min_term_months: number;
  renewal_months: number;
  notice_months: number;
  to_month_end: boolean;
  notes: string;
}

export const EMPTY_CONTRACT: ContractDefaults = {
  category: 'mobile',
  provider: '',
  product: '',
  customer_number: '',
  monthly_price: '',
  start_date: '',
  ...termsFor('mobile'),
  notes: '',
};

export function termsFor(category: Category) {
  const t = DEFAULT_TERMS[category];
  return { min_term_months: t.minTermMonths, renewal_months: t.renewalMonths, notice_months: t.noticeMonths, to_month_end: t.toMonthEnd };
}

type SaveAction = (state: FormState, fd: FormData) => Promise<FormState>;

export function ContractForm({ action, defaults, submitLabel }: { action: SaveAction; defaults: ContractDefaults; submitLabel: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [values, setValues] = useState(defaults);
  const set = (patch: Partial<ContractDefaults>) => setValues((v) => ({ ...v, ...patch }));
  const isHealth = values.category === 'krankenkasse_grund';

  return (
    <form action={formAction} className="stack">
      <div className="row">
        <label>
          Kategorie
          <select
            name="category"
            value={values.category}
            onChange={(e) => {
              const c = e.target.value;
              set(isCategory(c) ? { category: c, ...termsFor(c) } : { category: c });
            }}
          >
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <option key={key} value={key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label>
          Anbieter
          <input name="provider" value={values.provider} onChange={(e) => set({ provider: e.target.value })} required />
        </label>
        <label>
          Produkt / Tarif
          <input name="product" value={values.product} onChange={(e) => set({ product: e.target.value })} />
        </label>
      </div>
      <div className="row">
        <label>
          Preis pro Monat (CHF)
          <input name="monthly_price" inputMode="decimal" value={values.monthly_price} onChange={(e) => set({ monthly_price: e.target.value })} required />
        </label>
        <label>
          Kunden- / Vertragsnummer
          <input name="customer_number" value={values.customer_number} onChange={(e) => set({ customer_number: e.target.value })} />
        </label>
        <label>
          Vertragsbeginn
          <input name="start_date" type="date" value={values.start_date} onChange={(e) => set({ start_date: e.target.value })} />
        </label>
      </div>
      {isHealth ? (
        <p className="hint">
          Grundversicherung: Frist ist gesetzlich (Eingang bis 30.11., Wechsel per 1.1.). Laufzeitfelder werden ignoriert.
        </p>
      ) : null}
      <div className="row" style={isHealth ? { display: 'none' } : undefined}>
        <label>
          Mindestlaufzeit (Monate) <span className="hint">0 = keine</span>
          <input name="min_term_months" type="number" min={0} max={120} value={values.min_term_months} onChange={(e) => set({ min_term_months: Number(e.target.value) })} />
        </label>
        <label>
          Verlängerung danach (Monate) <span className="hint">0 = unbefristet</span>
          <input name="renewal_months" type="number" min={0} max={60} value={values.renewal_months} onChange={(e) => set({ renewal_months: Number(e.target.value) })} />
        </label>
        <label>
          Kündigungsfrist (Monate)
          <input name="notice_months" type="number" min={0} max={24} value={values.notice_months} onChange={(e) => set({ notice_months: Number(e.target.value) })} />
        </label>
      </div>
      <label className="check" style={isHealth ? { display: 'none' } : undefined}>
        <input name="to_month_end" type="checkbox" checked={values.to_month_end} onChange={(e) => set({ to_month_end: e.target.checked })} />
        <span>Kündigung nur auf ein Monatsende</span>
      </label>
      {!isHealth && <p className="hint">Vorschlagswerte sind Annahmen. Bitte mit Ihrem Vertrag oder den AGB des Anbieters abgleichen.</p>}
      <label>
        Notizen
        <textarea name="notes" value={values.notes} onChange={(e) => set({ notes: e.target.value })} style={{ minHeight: 60 }} />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <button type="submit" disabled={pending}>{submitLabel}</button>
      </div>
    </form>
  );
}
