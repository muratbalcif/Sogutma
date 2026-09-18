/** Allowed tags for product technical / compatibility rich content. */
const ALLOWED = new Set([
  'h2',
  'h3',
  'p',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'br',
  'a',
]);

const VOID_TAGS = new Set(['br']);

const ATTR_ALLOWED: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  th: new Set(['colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
};

function isSafeHref(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:')
  );
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowed = ATTR_ALLOWED[tag];
  if (!allowed || !rawAttrs.trim()) return '';

  const out: string[] = [];
  const attrRe =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = attrRe.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (name.startsWith('on')) continue;
    if (!allowed.has(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (name === 'href') {
      if (!isSafeHref(value)) continue;
      out.push(`href="${escapeAttr(value)}"`);
      out.push('target="_blank"');
      out.push('rel="noopener noreferrer"');
      continue;
    }
    if (name === 'target' || name === 'rel') continue;
    out.push(`${name}="${escapeAttr(value)}"`);
  }

  return out.length ? ` ${out.join(' ')}` : '';
}

/** Defense-in-depth sanitize for product rich HTML (API already sanitizes). */
export function sanitizeProductHtml(input: string | null | undefined): string {
  if (!input?.trim()) return '';

  const html = input
    .replace(
      /<(script|iframe|object|embed|form|style|link|meta|svg|math)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
      '',
    )
    .replace(
      /<(script|iframe|object|embed|form|style|link|meta|svg|math)(\s[^>]*)?\/?>/gi,
      '',
    )
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  const parts: string[] = [];
  const tokenRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9]+)(\s[^>]*)?\/?>|([^<]+)/g;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(html)) !== null) {
    if (m[0].startsWith('<!--')) continue;

    if (m[3] !== undefined) {
      parts.push(m[3]);
      continue;
    }

    const full = m[0];
    const tagName = m[1].toLowerCase();
    const attrs = m[2] ?? '';
    const isClose = full.startsWith('</');
    const selfClosing = full.endsWith('/>') || VOID_TAGS.has(tagName);

    if (!ALLOWED.has(tagName)) continue;

    if (isClose) {
      if (!VOID_TAGS.has(tagName)) parts.push(`</${tagName}>`);
      continue;
    }

    if (tagName === 'br' || (selfClosing && VOID_TAGS.has(tagName))) {
      parts.push('<br>');
      continue;
    }

    parts.push(`<${tagName}${sanitizeAttributes(tagName, attrs)}>`);
  }

  return parts.join('').trim();
}
