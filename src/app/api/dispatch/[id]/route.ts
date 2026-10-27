import { currentUser } from '@/lib/auth';
import { dispatchPdf } from '@/lib/dispatch/flow';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response('Nicht angemeldet', { status: 401 });
  const signed = new URL(req.url).searchParams.has('signiert');
  const pdf = dispatchPdf(user.id, Number((await params).id), signed);
  if (!pdf) return new Response('Nicht gefunden', { status: 404 });
  return new Response(Buffer.from(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="kuendigung${signed ? '-signiert' : ''}.pdf"`, 'Cache-Control': 'no-store' },
  });
}
