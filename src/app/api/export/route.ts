import { currentUser } from '@/lib/auth';
import { listContracts, listSwitches } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response('Nicht angemeldet', { status: 401 });
  const body = JSON.stringify(
    { exportiert_am: new Date().toISOString(), konto: user, vertraege: listContracts(user.id), wechsel: listSwitches(user.id) },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="abo-pilot-export.json"',
      'Cache-Control': 'no-store',
    },
  });
}
