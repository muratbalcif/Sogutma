import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ShippingProviderCode,
  ShippingStatus,
} from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { AddressSnapshot } from '../addresses/dto/address.dto';
import { OrderResponseDto } from './dto/order.dto';
import { OrderStatusService } from './order-status.service';

export type OrderWithRelations = {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  currency: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  customerNote: string | null;
  shippingAddressSnapshot: Prisma.JsonValue;
  billingAddressSnapshot: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    changedBy: string | null;
    createdAt: Date;
  }>;
  payments: Array<{
    id: string;
    status: PaymentStatus;
    method: PaymentMethod;
    amount: Prisma.Decimal;
    currency: string;
    provider: string | null;
    expiresAt: Date | null;
  }>;
  shipping?: {
    id: string;
    orderId: string;
    provider: ShippingProviderCode;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: ShippingStatus;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  orderReturn?: {
    id: string;
    returnReason: string | null;
    adminNote: string | null;
    createdAt: Date;
  } | null;
};

export function mapOrderToResponse(
  order: OrderWithRelations,
  orderStatusService?: OrderStatusService,
): OrderResponseDto {
  const latestPayment = order.payments[0] ?? null;
  const allowedTransitions = orderStatusService
    ? orderStatusService.getAllowedTransitions(order.status)
    : [];
  const canCancel = orderStatusService
    ? orderStatusService.canCustomerCancel(order.status)
    : false;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotal: toMoneyString(order.subtotal),
    discountAmount: toMoneyString(order.discountAmount),
    taxAmount: toMoneyString(order.taxAmount),
    shippingAmount: toMoneyString(order.shippingAmount),
    totalAmount: toMoneyString(order.totalAmount),
    customerNote: order.customerNote,
    shippingAddress:
      order.shippingAddressSnapshot as unknown as AddressSnapshot,
    billingAddress: order.billingAddressSnapshot as unknown as AddressSnapshot,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: toMoneyString(item.unitPrice),
      discountAmount: toMoneyString(item.discountAmount),
      taxAmount: toMoneyString(item.taxAmount),
      subtotal: toMoneyString(item.subtotal),
      totalAmount: toMoneyString(item.totalAmount),
    })),
    statusHistory: order.statusHistory.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      changedBy: entry.changedBy,
      createdAt: entry.createdAt,
    })),
    payment: latestPayment
      ? {
          id: latestPayment.id,
          status: latestPayment.status,
          method: latestPayment.method,
          amount: toMoneyString(latestPayment.amount),
          currency: latestPayment.currency,
          provider: latestPayment.provider,
          expiresAt: latestPayment.expiresAt,
        }
      : null,
    shipping: order.shipping
      ? {
          id: order.shipping.id,
          orderId: order.shipping.orderId,
          provider: order.shipping.provider,
          trackingNumber: order.shipping.trackingNumber,
          trackingUrl: order.shipping.trackingUrl,
          status: order.shipping.status,
          shippedAt: order.shipping.shippedAt,
          deliveredAt: order.shipping.deliveredAt,
          note: order.shipping.note,
          createdAt: order.shipping.createdAt,
          updatedAt: order.shipping.updatedAt,
        }
      : null,
    customer: order.user
      ? {
          id: order.user.id,
          email: order.user.email,
          firstName: order.user.firstName,
          lastName: order.user.lastName,
          phone: order.user.phone,
        }
      : undefined,
    orderReturn: order.orderReturn
      ? {
          id: order.orderReturn.id,
          returnReason: order.orderReturn.returnReason,
          adminNote: order.orderReturn.adminNote,
          createdAt: order.orderReturn.createdAt,
        }
      : null,
    allowedTransitions,
    canCancel,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export const orderDetailInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  shipping: true,
  orderReturn: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
} as const;

/** Safer include when optional relations may be unavailable mid-migration. */
export const orderDetailIncludeMinimal = {
  items: { orderBy: { createdAt: 'asc' as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
} as const;
