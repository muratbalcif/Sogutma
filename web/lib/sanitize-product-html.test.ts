import { sanitizeProductHtml } from './sanitize-product-html.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('sanitizeProductHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeProductHtml('<p>ok</p><script>alert(1)</script>');
    assert.ok(out.includes('<p>ok</p>'));
    assert.ok(!out.includes('script'));
  });

  it('strips event handlers', () => {
    const out = sanitizeProductHtml('<p onclick="x">t</p>');
    assert.ok(!out.includes('onclick'));
  });
});
