import { Prisma } from '@prisma/client';
import { calculateCheckoutLines } from './order-calculation';

describe('calculateCheckoutLines', () => {
  const product = {
    id: 'p1',
    name: 'Klima Motoru',
    sku: 'KM-001',
    active: true,
    vatRate: new Prisma.Decimal(20),
  };

  it('rejects empty cart', () => {
    const result = calculateCheckoutLines({
      items: [],
      prices: new Map(),
      stocks: new Map(),
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe('EMPTY_CART');
  });

  it('rejects inactive product', () => {
    const result = calculateCheckoutLines({
      items: [
        {
          productId: 'p1',
          quantity: 1,
          product: { ...product, active: false },
        },
      ],
      prices: new Map([
        ['p1', { amount: '1000.00', currency: 'TRY', type: 'RETAIL' }],
      ]),
      stocks: new Map([['p1', 5]]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRODUCT_INACTIVE')).toBe(true);
  });

  it('rejects unavailable price', () => {
    const result = calculateCheckoutLines({
      items: [{ productId: 'p1', quantity: 1, product }],
      prices: new Map([['p1', null]]),
      stocks: new Map([['p1', 5]]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRICE_UNAVAILABLE')).toBe(
      true,
    );
  });

  it('rejects insufficient stock', () => {
    const result = calculateCheckoutLines({
      items: [{ productId: 'p1', quantity: 4, product }],
      prices: new Map([
        ['p1', { amount: '1000.00', currency: 'TRY', type: 'RETAIL' }],
      ]),
      stocks: new Map([['p1', 2]]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'INSUFFICIENT_STOCK')).toBe(
      true,
    );
  });

  it('calculates tax-inclusive totals with Decimal precision', () => {
    const result = calculateCheckoutLines({
      items: [{ productId: 'p1', quantity: 2, product }],
      prices: new Map([
        ['p1', { amount: '1000.00', currency: 'TRY', type: 'RETAIL' }],
      ]),
      stocks: new Map([['p1', 5]]),
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0].unitPrice.toFixed(2)).toBe('1000.00');
    expect(result.lines[0].subtotal.toFixed(2)).toBe('2000.00');
    expect(result.lines[0].totalAmount.toFixed(2)).toBe('2000.00');
    // tax = 2000 * 20 / 120 = 333.33
    expect(result.lines[0].taxAmount.toFixed(2)).toBe('333.33');
    expect(result.summary?.total).toBe('2000.00');
    expect(result.summary?.shipping).toBe('0.00');
  });
});
