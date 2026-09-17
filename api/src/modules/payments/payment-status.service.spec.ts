import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentStatusService } from './payment-status.service';

describe('PaymentStatusService', () => {
  const service = new PaymentStatusService();

  it('allows PENDING to PAID and FAILED', () => {
    expect(() =>
      service.assertTransition(PaymentStatus.PENDING, PaymentStatus.PAID),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PaymentStatus.PENDING, PaymentStatus.FAILED),
    ).not.toThrow();
  });

  it('allows PAID to REFUNDED only', () => {
    expect(() =>
      service.assertTransition(PaymentStatus.PAID, PaymentStatus.REFUNDED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PaymentStatus.PAID, PaymentStatus.PENDING),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      service.assertTransition(PaymentStatus.REFUNDED, PaymentStatus.PAID),
    ).toThrow(BadRequestException);
  });
});
