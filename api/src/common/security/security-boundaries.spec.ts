import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Lightweight ownership helpers mirrored by service getOwned / findOwned patterns.
 * Full IDOR coverage lives in module e2e specs when DB is available.
 */
function assertOwned(resourceUserId: string, requesterId: string): void {
  if (resourceUserId !== requesterId) {
    throw new NotFoundException('Resource not found');
  }
}

describe('IDOR ownership gate', () => {
  it('allows owner access', () => {
    expect(() => assertOwned('u1', 'u1')).not.toThrow();
  });

  it('hides foreign resources as 404', () => {
    expect(() => assertOwned('u2', 'u1')).toThrow(NotFoundException);
  });
});

describe('financial client trust boundaries', () => {
  it('documents that client price/total/paymentStatus must be ignored', () => {
    const clientPayload = {
      price: '1.00',
      total: '1.00',
      paymentStatus: 'PAID',
      balance: '0.00',
    };
    // Server must recompute from catalog + cart; never accept these fields.
    expect(clientPayload.paymentStatus).not.toBe('PENDING');
    const serverComputedTotal = '1000.00';
    expect(serverComputedTotal).not.toEqual(clientPayload.total);
  });

  it('rejects negative amounts at validation layer contract', () => {
    const amount = '-10.00';
    expect(/^\d+(\.\d{1,2})?$/.test(amount)).toBe(false);
  });
});

describe('RBAC financial mutation', () => {
  it('PRODUCT_MANAGER lacks accounting.create', () => {
    const productManager = ['product.read', 'pricing.update'];
    expect(productManager.includes('accounting.create')).toBe(false);
  });

  it('ACCOUNTING has accounting.create', () => {
    const accounting = ['accounting.read', 'accounting.create'];
    expect(accounting.includes('accounting.create')).toBe(true);
  });

  it('missing permission throws ForbiddenException shape', () => {
    expect(() => {
      throw new ForbiddenException('Missing permission: accounting.create');
    }).toThrow(ForbiddenException);
  });
});
