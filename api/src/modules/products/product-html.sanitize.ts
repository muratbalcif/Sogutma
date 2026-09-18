/** Allowed tags for product technical / compatibility rich content. */
export const PRODUCT_HTML_ALLOWED_TAGS = [
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
] as const;

const ALLOWED = new Set<string>(PRODUCT_HTML_ALLOWED_TAGS);
const VOID_TAGS = new Set(['br']);
const MAX_HTML_LENGTH = 50_000;

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

function sanitizeAttributes(
  tag: string,
  rawAttrs: string,
): string {
  const allowed = ATTR_ALLOWED[tag];
  if (!allowed || !rawAttrs.trim()) {
    return '';
  }

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

/**
 * Sanitize product rich HTML: strip scripts, iframes, event handlers, javascript: URLs.
 * Returns null for empty/whitespace-only input.
 */
export function sanitizeProductHtml(
  input: string | null | undefined,
): string | null {
  if (input == null) {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_HTML_LENGTH) {
    throw new Error(`HTML content exceeds ${MAX_HTML_LENGTH} characters`);
  }

  // Drop dangerous blocks entirely (including content)
  let html = trimmed
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

    if (!ALLOWED.has(tagName)) {
      continue;
    }

    if (isClose) {
      if (!VOID_TAGS.has(tagName)) {
        parts.push(`</${tagName}>`);
      }
      continue;
    }

    if (tagName === 'br' || selfClosing && VOID_TAGS.has(tagName)) {
      parts.push('<br>');
      continue;
    }

    const safeAttrs = sanitizeAttributes(tagName, attrs);
    parts.push(`<${tagName}${safeAttrs}>`);
  }

  const result = parts.join('').trim();
  return result.length > 0 ? result : null;
}
