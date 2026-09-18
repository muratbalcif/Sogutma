import { buildPaymentReference } from './payment-reference.util';

describe('buildPaymentReference', () => {
  it('uses order number when it already starts with FS-', () => {
    const ref = buildPaymentReference('FS-20260918-000042');
    expect(ref).toMatch(/^FS-20260918-000042-[A-F0-9]{6}$/);
  });

  it('prefixes FS- when order number lacks it', () => {
    const ref = buildPaymentReference('20260918-000042');
    expect(ref).toMatch(/^FS-20260918-000042-[A-F0-9]{6}$/);
  });

  it('generates unique short codes', () => {
    const a = buildPaymentReference('FS-1');
    const b = buildPaymentReference('FS-1');
    expect(a).not.toBe(b);
  });
});
