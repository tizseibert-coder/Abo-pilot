// Abruf öffentlicher Tarifseiten: robots.txt wird respektiert, der Bot gibt sich zu erkennen,
// und jede Seite wird höchstens einmal pro Lauf geladen.

export const USER_AGENT = 'AboPilotBot/0.1 (+https://abo-pilot.ch/bot; Preisvergleich fuer Privathaushalte)';
const BOT_TOKEN = 'abopilotbot';
const MAX_BYTES = 3 * 1024 * 1024;

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && (key === 'allow' || key === 'disallow')) {
      if (value) current.rules.push({ allow: key === 'allow', path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function ruleMatches(rulePath: string, path: string): boolean {
  const pattern = '^' + rulePath.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
  return new RegExp(pattern.endsWith('$') ? pattern : pattern).test(path);
}

/** Längste passende Regel gewinnt; bei Gleichstand gewinnt Allow (wie Google). */
export function robotsAllows(robotsTxt: string, path: string): boolean {
  const groups = parseRobots(robotsTxt);
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a))) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    if (!ruleMatches(r.path, path)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}

export class FetchBlocked extends Error {}

async function readLimited(res: Response): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new FetchBlocked(`Seite zu gross (${declared} Bytes)`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new FetchBlocked(`Seite zu gross (${buf.byteLength} Bytes)`);
  return new TextDecoder('utf-8').decode(buf);
}

export async function fetchPage(url: string): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new FetchBlocked('Nur https-Seiten werden abgerufen.');
  const robots = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (robots?.ok && !robotsAllows(await robots.text(), u.pathname + u.search)) {
    throw new FetchBlocked('robots.txt der Seite erlaubt den Abruf nicht.');
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'de-CH,de;q=0.9' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new FetchBlocked(`HTTP ${res.status}`);
  return readLimited(res);
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', shy: '', euro: '€' };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
