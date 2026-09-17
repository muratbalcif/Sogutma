import { CouponType, Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';

describe('CouponsService', () => {
  const prisma = {
    coupon: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    couponUsage: {
      count: jest.fn(),
      create: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const service = new CouponsService(prisma as never, audit as never);

  const baseCoupon = {
    id: 'c1',
    code: 'FURKAN10',
    description: null,
    type: CouponType.PERCENTAGE,
    value: new Prisma.Decimal(20),
    minimumOrderAmount: new Prisma.Decimal(100),
    maximumDiscountAmount: new Prisma.Decimal(1000),
    usageLimit: 100,
    perUserLimit: 1,
    startsAt: new Date(Date.now() - 86400000),
    endsAt: new Date(Date.now() + 86400000),
    active: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.couponUsage.count.mockResolvedValue(0);
  });

  it('normalizes code case-insensitively', () => {
    expect(service.normalizeCode('furkan10')).toBe('FURKAN10');
  });

  it('validates active coupon and caps max discount', async () => {
    prisma.coupon.findUnique.mockResolvedValue(baseCoupon);
    const result = await service.validateForUser({
      code: 'furkan10',
      userId: 'u1',
      orderAmount: new Prisma.Decimal(5000),
    });
    expect(result.valid).toBe(true);
    // 20% of 5000 = 1000 capped by maximumDiscountAmount
    expect(result.discountAmount).toBe('1000.00');
  });

  it('rejects expired coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      ...baseCoupon,
      endsAt: new Date(Date.now() - 1000),
    });
    const result = await service.validateForUser({
      code: 'FURKAN10',
      userId: 'u1',
      orderAmount: new Prisma.Decimal(500),
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  it('rejects below minimum order', async () => {
    prisma.coupon.findUnique.mockResolvedValue(baseCoupon);
    const result = await service.validateForUser({
      code: 'FURKAN10',
      userId: 'u1',
      orderAmount: new Prisma.Decimal(50),
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Minimum/i);
  });

  it('rejects when per-user limit reached', async () => {
    prisma.coupon.findUnique.mockResolvedValue(baseCoupon);
    prisma.couponUsage.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1); // user
    const result = await service.validateForUser({
      code: 'FURKAN10',
      userId: 'u1',
      orderAmount: new Prisma.Decimal(500),
    });
    expect(result.valid).toBe(false);
  });

  it('calculates fixed amount discount', () => {
    const discount = service.calculateDiscount(
      {
        ...baseCoupon,
        type: CouponType.FIXED_AMOUNT,
        value: new Prisma.Decimal(150),
        maximumDiscountAmount: null,
      } as never,
      new Prisma.Decimal(500),
    );
    expect(discount.toFixed(2)).toBe('150.00');
  });
});
