import { NewContractFlow } from '@/components/NewContractFlow';
import { requireUser } from '@/lib/auth';
import { saveContract } from '../../actions';

export default async function NewContract() {
  await requireUser();
  return (
    <>
      <h1>Vertrag erfassen</h1>
      <p className="lead">Fügen Sie eine Rechnung ein oder füllen Sie die Felder direkt aus.</p>
      <NewContractFlow save={saveContract.bind(null, null)} />
    </>
  );
}
