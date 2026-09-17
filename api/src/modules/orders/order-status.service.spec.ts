import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderStatusService } from './order-status.service';

describe('OrderStatusService', () => {
  const service = new OrderStatusService();

  it('allows customer cancel from PENDING and CONFIRMED', () => {
    expect(service.canCustomerCancel(OrderStatus.PENDING)).toBe(true);
    expect(service.canCustomerCancel(OrderStatus.CONFIRMED)).toBe(true);
    expect(service.canCustomerCancel(OrderStatus.SHIPPED)).toBe(false);
    expect(service.canCustomerCancel(OrderStatus.DELIVERED)).toBe(false);
  });

  it('allows valid admin transitions', () => {
    expect(() =>
      service.assertTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING),
    ).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      service.assertTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING),
    ).toThrow(BadRequestException);
  });
});
