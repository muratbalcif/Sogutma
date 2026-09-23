import {
  ADMIN_PERMISSION_CODES,
  POS_CASHIER_PERMISSION_CODES,
} from './permissions';

describe('POS permission catalog', () => {
  it('includes pos.refund in global catalog', () => {
    expect(ADMIN_PERMISSION_CODES).toContain('pos.read');
    expect(ADMIN_PERMISSION_CODES).toContain('pos.refund');
    expect(ADMIN_PERMISSION_CODES).toContain('pos.register');
  });

  it('assigns pos.refund to POS_CASHIER role codes', () => {
    expect(POS_CASHIER_PERMISSION_CODES).toContain('pos.read');
    expect(POS_CASHIER_PERMISSION_CODES).toContain('pos.sell');
    expect(POS_CASHIER_PERMISSION_CODES).toContain('pos.refund');
    expect(POS_CASHIER_PERMISSION_CODES).not.toContain('pos.register');
  });
});
