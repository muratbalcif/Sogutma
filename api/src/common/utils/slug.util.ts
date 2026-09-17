export function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    Ç: 'c',
    ğ: 'g',
    Ğ: 'g',
    ı: 'i',
    İ: 'i',
    ö: 'o',
    Ö: 'o',
    ş: 's',
    Ş: 's',
    ü: 'u',
    Ü: 'u',
  };
  const normalized = input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized.slice(0, 200) || 'urun';
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const slug = slugifyTr(base);
  if (!(await exists(slug))) {
    return slug;
  }
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${slug.slice(0, 190)}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  return `${slug}-${Date.now()}`;
}
