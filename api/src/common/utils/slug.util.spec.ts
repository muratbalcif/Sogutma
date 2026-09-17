import { slugifyTr, uniqueSlug } from './slug.util';

describe('slugifyTr', () => {
  it('normalizes Turkish characters', () => {
    expect(slugifyTr('Duvar Tipi Klima 12000 BTU')).toBe(
      'duvar-tipi-klima-12000-btu',
    );
    expect(slugifyTr('Çiğli Şöför Ürünü')).toBe('cigli-sofor-urunu');
  });

  it('generates unique suffix on conflict', async () => {
    const existing = new Set(['klima', 'klima-2']);
    const slug = await uniqueSlug('Klima', (s) =>
      Promise.resolve(existing.has(s)),
    );
    expect(slug).toBe('klima-3');
  });
});
