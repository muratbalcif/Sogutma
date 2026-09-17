import { BadRequestException } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ManualShippingProvider } from './manual-shipping.provider';

describe('ShippingService', () => {
  const prisma = {
    shipping: { findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
  };
  const manual = new ManualShippingProvider();
  const service = new ShippingService(prisma as never, manual, [manual]);

  it('sanitizes https tracking URLs', () => {
    expect(
      service.sanitizeTrackingUrl(
        'https://www.yurticikargo.com/tr/track?code=1',
      ),
    ).toContain('yurticikargo.com');
  });

  it('rejects non-http(s) tracking URLs', () => {
    expect(() => service.sanitizeTrackingUrl('javascript:alert(1)')).toThrow(
      BadRequestException,
    );
  });

  it('upserts manual shipment in transaction', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 's1' });
    const tx = { shipping: { upsert } };
    await service.upsertManualShipmentInTransaction(tx as never, {
      orderId: 'o1',
      trackingNumber: 'TRK123',
      trackingUrl: 'https://example.com/track/1',
      note: 'sent',
    });
    expect(upsert).toHaveBeenCalled();
  });
});
