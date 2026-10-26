import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContractForm } from '@/components/ContractForm';
import { requireUser } from '@/lib/auth';
import { getContract } from '@/lib/repo';
import { saveContract } from '../../../actions';

export default async function EditContract({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!c) notFound();
  return (
    <>
      <p className="small"><Link href={`/vertraege/${c.id}`}>← zurück</Link></p>
      <h1>{c.provider} bearbeiten</h1>
      <section className="card">
        <ContractForm
          action={saveContract.bind(null, c.id)}
          submitLabel="Änderungen speichern"
          defaults={{
            category: c.category,
            provider: c.provider,
            product: c.product,
            customer_number: c.customer_number,
            monthly_price: c.monthly_price.toFixed(2),
            start_date: c.start_date ?? '',
            min_term_months: c.min_term_months,
            renewal_months: c.renewal_months,
            notice_months: c.notice_months,
            to_month_end: c.to_month_end === 1,
            notes: c.notes,
          }}
        />
      </section>
    </>
  );
}
