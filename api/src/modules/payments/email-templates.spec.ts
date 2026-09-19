import {
  buildTransactionalEmail,
  isCriticalEmailEvent,
  isMarketingEmailEvent,
} from './email-templates';

describe('email-templates', () => {
  it('escapes user-controlled HTML in transactional body', () => {
    const built = buildTransactionalEmail('ORDER_CREATED', {
      customerName: '<script>alert(1)</script>',
      orderNumber: 'FS-1',
      siteName: 'FurkanSoğutma',
      supportEmail: 'info@example.com',
      siteUrl: 'https://example.com',
    });
    expect(built.html).not.toContain('<script>alert(1)</script>');
    expect(built.html).toContain('&lt;script&gt;');
    expect(built.text).toContain('FS-1');
    expect(built.subject).toContain('FS-1');
  });

  it('classifies marketing vs critical events', () => {
    expect(isMarketingEmailEvent('CAMPAIGN_STARTED')).toBe(true);
    expect(isMarketingEmailEvent('ORDER_CREATED')).toBe(false);
    expect(isCriticalEmailEvent('PASSWORD_RESET')).toBe(true);
    expect(isCriticalEmailEvent('ORDER_SHIPPED')).toBe(false);
  });
});
