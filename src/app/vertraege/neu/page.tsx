import { NewContractFlow } from '@/components/NewContractFlow';
import { NewContractTabs, QuickCheckForm } from '@/components/QuickCheck';
import { requireUser } from '@/lib/auth';
import { saveContract } from '../../actions';

export default async function NewContract() {
  await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vertrag prüfen</h1>
          <p>Drei Angaben genügen. Wir zeigen sofort Ihre Kündigungsfrist und was ein Wechsel bringt.</p>
        </div>
      </div>
      <NewContractTabs quick={<QuickCheckForm />} detailed={<NewContractFlow save={saveContract.bind(null, null)} />} />
    </>
  );
}
