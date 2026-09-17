import { Prisma, UserType } from '@prisma/client';
import {
  extractInclusiveTax,
  multiplyMoney,
  sumMoney,
  toMoneyString,
} from '../../common/utils/money.util';
import { ResolvedPriceDto } from '../pricing/dto/pricing.dto';
import {
  CheckoutItemDto,
  OrderIssueDto,
  OrderTotalsDto,
} from './dto/order.dto';

export type CartLineForCheckout = {
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
    active: boolean;
    vatRate: Prisma.Decimal;
  } | null;
};

export type CalculatedLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  currency: string;
};

export type CheckoutCalculation = {
  valid: boolean;
  issues: OrderIssueDto[];
  lines: CalculatedLine[];
  summary: OrderTotalsDto | null;
};

/**
 * Prices from PriceService are tax-inclusive (KDV dahil).
 * Tax is extracted for reporting; customer total remains inclusive.
 */
export function calculateCheckoutLines(input: {
  items: CartLineForCheckout[];
  prices: Map<string, ResolvedPriceDto | null>;
  stocks: Map<string, number>;
}): CheckoutCalculation {
  const issues: OrderIssueDto[] = [];
  const lines: CalculatedLine[] = [];

  if (input.items.length === 0) {
    issues.push({
      code: 'EMPTY_CART',
      message: 'Cart is empty',
    });
    return { valid: false, issues, lines, summary: null };
  }

  for (const item of input.items) {
    if (!item.product) {
      issues.push({
        code: 'PRODUCT_NOT_FOUND',
        productId: item.productId,
        message: 'Product no longer exists',
      });
      continue;
    }
    if (!item.product.active) {
      issues.push({
        code: 'PRODUCT_INACTIVE',
        productId: item.productId,
        message: 'Product is inactive',
      });
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      issues.push({
        code: 'INVALID_QUANTITY',
        productId: item.productId,
        message: 'Quantity must be a positive integer',
      });
    }
    const price = input.prices.get(item.productId) ?? null;
    if (!price) {
      issues.push({
        code: 'PRICE_UNAVAILABLE',
        productId: item.productId,
        message: 'Price cannot be resolved for this product',
      });
      continue;
    }
    const available = input.stocks.get(item.productId) ?? 0;
    if (item.quantity > available) {
      issues.push({
        code: 'INSUFFICIENT_STOCK',
        productId: item.productId,
        message: 'Requested quantity is greater than available stock',
      });
    }

    const unitPrice = new Prisma.Decimal(price.amount);
    const discountAmount = new Prisma.Decimal(0);
    const subtotal = multiplyMoney(unitPrice, item.quantity);
    const payable = subtotal.sub(discountAmount);
    const taxAmount = extractInclusiveTax(payable, item.product.vatRate);

    lines.push({
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice,
      discountAmount,
      taxAmount,
      subtotal,
      totalAmount: payable,
      currency: price.currency,
    });
  }

  const valid = issues.length === 0;
  if (!valid) {
    return { valid: false, issues, lines, summary: null };
  }

  const subtotal = sumMoney(lines.map((line) => line.subtotal));
  const discount = sumMoney(lines.map((line) => line.discountAmount));
  const tax = sumMoney(lines.map((line) => line.taxAmount));
  const shipping = new Prisma.Decimal(0);
  const total = sumMoney(lines.map((line) => line.totalAmount)).add(shipping);
  const currency = lines[0]?.currency ?? 'TRY';

  return {
    valid: true,
    issues: [],
    lines,
    summary: {
      subtotal: toMoneyString(subtotal),
      discount: toMoneyString(discount),
      tax: toMoneyString(tax),
      shipping: toMoneyString(shipping),
      total: toMoneyString(total),
      currency,
    },
  };
}

export function toCheckoutItems(lines: CalculatedLine[]): CheckoutItemDto[] {
  return lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    quantity: line.quantity,
    unitPrice: toMoneyString(line.unitPrice),
    discountAmount: toMoneyString(line.discountAmount),
    taxAmount: toMoneyString(line.taxAmount),
    subtotal: toMoneyString(line.subtotal),
    totalAmount: toMoneyString(line.totalAmount),
    currency: line.currency,
  }));
}

export type PriceContext = {
  customerId: string;
  userType: UserType;
};
