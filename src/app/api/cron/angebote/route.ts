import { timingSafeEqual } from 'node:crypto';
import { runAllSources } from '@/lib/crawler/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Täglicher Suchlauf über alle aktiven Angebotsquellen (Server-Cronjob). */
export async function POST(req: Request) {
  if (!authorized(req)) return new Response('Nicht berechtigt', { status: 401 });
  const results = await runAllSources(false);
  return Response.json({ ran: results.length, results });
}
