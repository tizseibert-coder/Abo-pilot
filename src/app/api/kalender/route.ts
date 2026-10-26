import { currentUser } from '@/lib/auth';
import { categoryLabel } from '@/lib/categories';
import { formatCH, today } from '@/lib/dates';
import { buildCalendar, type CalendarEvent } from '@/lib/ics';
import { buildOverview } from '@/lib/overview';
import { listContracts, listSwitches } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response('Nicht angemeldet', { status: 401 });
  const { views } = buildOverview(listContracts(user.id), listSwitches(user.id), today());
  const events: CalendarEvent[] = views
    .filter((v) => v.deadline.kind !== 'unbefristet')
    .map((v) => ({
      uid: `abo-pilot-${user.id}-${v.contract.id}-${v.deadline.deadline}`,
      date: v.deadline.deadline,
      summary: `Kündigungsfrist ${v.contract.provider}`,
      description: `${categoryLabel(v.contract.category)}: Kündigung muss bis ${formatCH(v.deadline.deadline)} eintreffen, Vertragsende ${formatCH(v.deadline.endDate)}.`,
      alarmsDaysBefore: [60, 30, 7],
    }));
  return new Response(buildCalendar(events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="abo-pilot-fristen.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
