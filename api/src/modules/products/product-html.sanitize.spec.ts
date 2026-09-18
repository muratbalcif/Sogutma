import { sanitizeProductHtml } from './product-html.sanitize';

describe('sanitizeProductHtml', () => {
  it('returns null for empty input', () => {
    expect(sanitizeProductHtml(null)).toBeNull();
    expect(sanitizeProductHtml(undefined)).toBeNull();
    expect(sanitizeProductHtml('')).toBeNull();
    expect(sanitizeProductHtml('   ')).toBeNull();
  });

  it('keeps allowed tags', () => {
    const html =
      '<h2>Başlık</h2><p>Metin <strong>kalın</strong></p><ul><li>Madde</li></ul>';
    const out = sanitizeProductHtml(html);
    expect(out).toContain('<h2>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
  });

  it('allows tables', () => {
    const html =
      '<table><thead><tr><th>Özellik</th></tr></thead><tbody><tr><td>Değer</td></tr></tbody></table>';
    const out = sanitizeProductHtml(html);
    expect(out).toContain('<table>');
    expect(out).toContain('<th>');
    expect(out).toContain('<td>');
  });

  it('strips script and iframe', () => {
    const html =
      '<p>OK</p><script>alert(1)</script><iframe src="https://evil.com"></iframe>';
    const out = sanitizeProductHtml(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('<p>OK</p>');
  });

  it('strips inline event handlers', () => {
    const html =
      '<p onclick="alert(1)">x</p><a href="https://a.com" onmouseover="evil()">y</a>';
    const out = sanitizeProductHtml(html)!;
    expect(out).not.toMatch(/on\w+=/i);
    expect(out).not.toContain('alert');
  });

  it('neutralizes javascript: urls', () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const out = sanitizeProductHtml(html)!;
    expect(out).not.toContain('javascript:');
  });

  it('keeps safe http(s) links with rel noopener', () => {
    const html = '<a href="https://example.com">link</a>';
    const out = sanitizeProductHtml(html)!;
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
