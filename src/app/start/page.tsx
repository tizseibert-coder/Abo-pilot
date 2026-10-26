import { OnboardingForm } from '@/components/OnboardingForm';
import { requireUser } from '@/lib/auth';
import { DEFAULT_PROFILE } from '@/lib/profile';
import { getProfile, listContracts } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function Start() {
  const user = await requireUser();
  const profile = getProfile(user.id);
  return (
    <>
      <h1>{profile ? 'Ihr Profil' : 'In 2 Minuten startklar'}</h1>
      <p className="lead">
        Drei kurze Fragen. Damit zeigen wir nur Angebote, die zu Ihnen passen, und überwachen Ihre Fristen.
      </p>
      <OnboardingForm profile={profile ?? DEFAULT_PROFILE} hasContracts={listContracts(user.id).length > 0} />
    </>
  );
}
