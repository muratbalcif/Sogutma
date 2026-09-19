import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  AccountTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { sumMoney } from '../../common/utils/money.util';
import { EnvironmentVariables } from '../../config/env.validation';
import { AddressesService } from '../addresses/addresses.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPaymentReference } from '../payments/payment-reference.util';
import { BankAccountsService } from '../payments/bank-accounts.service';
import { EmailOutboxService } from '../payments/email-outbox.service';
import { AccountingService } from '../payments/accounting.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShipOrderDto, StartReturnDto } from '../shipping/dto/shipping.dto';
import { ShippingService } from '../shipping/shipping.service';
import {
  AdminOrderListQueryDto,
  CreateOrderDto,
  OrderResponseDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { calculateCheckoutLines } from './order-calculation';
import { mapOrderToResponse, orderDetailInclude } from './order.mapper';
import { OrderStatusService } from './order-status.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
    private readonly inventoryService: InventoryService,
    private readonly addressesService: AddressesService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly emailOutbox: EmailOutboxService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly shippingService: ShippingService,
    private readonly orderStatusService: OrderStatusService,
    private readonly couponsService: CouponsService,
    private readonly accountingService: AccountingService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  private toResponse(
    order: Parameters<typeof mapOrderToResponse>[0],
  ): OrderResponseDto {
    return mapOrderToResponse(order, this.orderStatusService);
  }

  async create(
    userId: string,
    userType: UserType,
    dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Inactive or blocked customers cannot order',
      );
    }

    const shipping = await this.addressesService.getOwned(
      userId,
      dto.shippingAddressId,
    );
    const billing = await this.addressesService.getOwned(
      userId,
      dto.billingAddressId,
    );
    const shippingSnapshot = this.addressesService.toSnapshot(shipping);
    const billingSnapshot = this.addressesService.toSnapshot(billing);

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const cart = await tx.cart.findUnique({
            where: { userId },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      active: true,
                      vatRate: true,
                    },
                  },
                },
              },
            },
          });

          const items = cart?.items ?? [];
          if (items.length === 0) {
            throw new ConflictException('Cart is empty');
          }

          const productIds = [
            ...new Set(items.map((item) => item.productId)),
          ].sort();
          const prices = await this.priceService.resolvePricesForProducts(
            productIds,
            { customerId: userId, userType },
          );

          const stocks = new Map<string, number>();
          for (const productId of productIds) {
            await tx.$queryRaw`
              SELECT id
              FROM inventories
              WHERE "productId" = ${productId}::uuid
              FOR UPDATE
            `;
            const inventory = await tx.inventory.findUnique({
              where: { productId },
            });
            stocks.set(
              productId,
              inventory ? inventory.quantity - inventory.reservedQuantity : 0,
            );
          }

          const calculation = calculateCheckoutLines({
            items: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              product: item.product,
            })),
            prices,
            stocks,
          });

          if (!calculation.valid || !calculation.summary) {
            const stockIssue = calculation.issues.find(
              (issue) => issue.code === 'INSUFFICIENT_STOCK',
            );
            if (stockIssue) {
              throw new ConflictException('Insufficient stock');
            }
            const empty = calculation.issues.find(
              (issue) => issue.code === 'EMPTY_CART',
            );
            if (empty) {
              throw new ConflictException('Cart is empty');
            }
            throw new ConflictException(
              calculation.issues[0]?.message ?? 'Checkout validation failed',
            );
          }

          const orderNumber = await this.nextOrderNumber(tx);
          const subtotal = sumMoney(
            calculation.lines.map((line) => line.subtotal),
          );
          const lineDiscount = sumMoney(
            calculation.lines.map((line) => line.discountAmount),
          );
          const merchandiseTotal = sumMoney(
            calculation.lines.map((line) => line.totalAmount),
          );

          let couponId: string | null = null;
          let couponCode: string | null = null;
          let couponDiscountAmount = new Prisma.Decimal(0);
          if (dto.couponCode) {
            const couponResult = await this.couponsService.validateForUser({
              code: dto.couponCode,
              userId,
              orderAmount: merchandiseTotal,
            });
            if (!couponResult.valid || !couponResult.couponId) {
              throw new BadRequestException(
                couponResult.message ?? 'Invalid coupon',
              );
            }
            couponId = couponResult.couponId;
            couponCode = couponResult.code ?? null;
            couponDiscountAmount = new Prisma.Decimal(
              couponResult.discountAmount!,
            );
          }

          const discountAmount = lineDiscount.add(couponDiscountAmount);
          const taxAmount = sumMoney(
            calculation.lines.map((line) => line.taxAmount),
          );
          const shippingAmount = new Prisma.Decimal(0);
          const totalAmount = merchandiseTotal
            .sub(couponDiscountAmount)
            .add(shippingAmount);
          const currency = calculation.summary.currency;

          await this.accountingService.assertCreditLimitAllows(
            userId,
            totalAmount,
          );

          const corporate = await tx.corporateCustomer.findUnique({
            where: { userId },
          });
          let dueDate: Date | null = null;
          if (
            corporate &&
            (corporate.allowCredit || corporate.paymentTermDays > 0)
          ) {
            dueDate = new Date();
            dueDate.setUTCDate(
              dueDate.getUTCDate() + (corporate.paymentTermDays || 0),
            );
          }

          const order = await tx.order.create({
            data: {
              orderNumber,
              userId,
              status: OrderStatus.PENDING,
              currency,
              subtotal,
              discountAmount,
              taxAmount,
              shippingAmount,
              totalAmount,
              couponId,
              couponCode,
              couponDiscountAmount,
              dueDate,
              shippingAddressId: shipping.id,
              billingAddressId: billing.id,
              shippingAddressSnapshot:
                shippingSnapshot as unknown as Prisma.InputJsonValue,
              billingAddressSnapshot:
                billingSnapshot as unknown as Prisma.InputJsonValue,
              customerNote: dto.customerNote,
              items: {
                create: calculation.lines.map((line) => ({
                  productId: line.productId,
                  productName: line.productName,
                  sku: line.sku,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  discountAmount: line.discountAmount,
                  taxAmount: line.taxAmount,
                  subtotal: line.subtotal,
                  totalAmount: line.totalAmount,
                })),
              },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: OrderStatus.PENDING,
                  note: 'Order created',
                  changedBy: userId,
                },
              },
            },
          });

          if (couponId) {
            await this.couponsService.recordUsage({
              tx,
              couponId,
              userId,
              orderId: order.id,
              discountAmount: couponDiscountAmount,
            });
          }

          await this.accountingService.recordIfAbsent({
            tx,
            userId,
            orderId: order.id,
            type: AccountTransactionType.SALE,
            amount: totalAmount,
            currency,
            description: `Sale for order ${order.orderNumber}`,
            reference: `SALE:ORDER:${order.id}`,
            referenceType: 'ORDER',
            referenceId: order.id,
            createdBy: userId,
          });

          for (const line of calculation.lines) {
            await this.inventoryService.reserveStockInTransaction(
              tx,
              line.productId,
              line.quantity,
              {
                createdBy: userId,
                referenceType: 'ORDER',
                referenceId: order.id,
                note: `Reserved for ${order.orderNumber}`,
              },
            );
          }

          const expiryHours =
            this.config.get('PAYMENT_EXPIRY_HOURS', { infer: true }) ?? 24;
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: PaymentMethod.BANK_TRANSFER,
              status: PaymentStatus.PENDING,
              amount: totalAmount,
              currency,
              expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
              paymentReference: buildPaymentReference(order.orderNumber),
            },
          });

          if (cart) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          }

          return { orderId: order.id, orderNumber: order.orderNumber };
        },
        { timeout: 15000 },
      );

      try {
        if (this.notificationsService) {
          await this.notificationsService.notifyOrderCreated(
            created.orderId,
            userId,
            created.orderNumber,
          );
          await this.notificationsService.notifyPaymentPending(
            created.orderId,
            userId,
            created.orderNumber,
          );
        }

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });
        if (user?.email) {
          await this.emailOutbox.enqueueOrderEmail({
            event: 'ORDER_CREATED',
            toEmail: user.email,
            customerName: `${user.firstName} ${user.lastName}`.trim(),
            orderId: created.orderId,
            orderNumber: created.orderNumber,
            status: OrderStatus.PENDING,
            totalAmount: undefined,
          });
        }
      } catch {
        // Outbox / email must never fail the checkout response.
      }

      const response = await this.getByIdForUser(userId, created.orderId);
      const bankAccounts = await this.bankAccountsService.listPublic();
      return { ...response, bankAccounts };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Order number collision, please retry');
      }
      throw error;
    }
  }

  async listForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const where = { userId };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
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
        },
      }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) =>
        this.toResponse({
          ...order,
          shipping: order.shipping ?? null,
          orderReturn: order.orderReturn ?? null,
        }),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async getByIdForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.findOrderDetail(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to user');
    }
    return this.toResponse(order);
  }

  async cancelForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      return this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId,
        toStatus: OrderStatus.CANCELLED,
        note: 'Cancelled by customer',
        changedByUserId: userId,
        requireOwnerUserId: userId,
        customerCancel: true,
        cancelPendingPayments: true,
      });
    });

    await this.afterStatusChange(result);
    return this.getByIdForUser(userId, orderId);
  }

  async listAdmin(
    query: AdminOrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildAdminWhere(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: orderDetailInclude,
      }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.toResponse(order)),
      total,
      page,
      limit,
    );
  }

  async getAdminById(orderId: string): Promise<OrderResponseDto> {
    const order = await this.findOrderDetail(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.toResponse(order);
  }

  private async findOrderDetail(orderId: string) {
    try {
      return await this.prisma.order.findUnique({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    } catch {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
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
        },
      });
      if (!order) {
        return null;
      }
      return { ...order, shipping: null, orderReturn: null };
    }
  }

  async updateStatusAdmin(
    orderId: string,
    adminUserId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    if (dto.status === OrderStatus.SHIPPED) {
      throw new BadRequestException(
        'Use POST /admin/orders/:id/ship to ship with tracking',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId,
        toStatus: dto.status,
        note: dto.note,
        changedByUserId: adminUserId,
        returnReason: dto.returnReason,
        adminReturnNote: dto.adminNote,
        cancelPendingPayments: dto.status === OrderStatus.CANCELLED,
      });
    });

    await this.afterStatusChange(result);
    return this.getAdminById(orderId);
  }

  async shipOrderAdmin(
    orderId: string,
    adminUserId: string,
    dto: ShipOrderDto,
  ): Promise<OrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.shippingService.upsertManualShipmentInTransaction(tx, {
        orderId,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        note: dto.note,
      });

      return this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId,
        toStatus: OrderStatus.SHIPPED,
        note: dto.note ?? 'Shipped',
        changedByUserId: adminUserId,
      });
    });

    await this.afterStatusChange(result, {
      trackingNumber: dto.trackingNumber,
      trackingUrl: dto.trackingUrl,
    });
    return this.getAdminById(orderId);
  }

  async deliverOrderAdmin(
    orderId: string,
    adminUserId: string,
    note?: string,
  ): Promise<OrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      return this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId,
        toStatus: OrderStatus.DELIVERED,
        note: note ?? 'Delivered',
        changedByUserId: adminUserId,
      });
    });

    await this.afterStatusChange(result);
    return this.getAdminById(orderId);
  }

  async startReturnAdmin(
    orderId: string,
    adminUserId: string,
    dto: StartReturnDto,
  ): Promise<OrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      return this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId,
        toStatus: OrderStatus.RETURNED,
        note: dto.adminNote ?? 'Return started',
        changedByUserId: adminUserId,
        returnReason: dto.returnReason,
        adminReturnNote: dto.adminNote,
      });
    });

    await this.afterStatusChange(result);
    return this.getAdminById(orderId);
  }

  private async afterStatusChange(
    result: {
      orderId: string;
      userId: string;
      orderNumber: string;
      toStatus: OrderStatus;
    },
    shippingMeta?: { trackingNumber?: string; trackingUrl?: string | null },
  ): Promise<void> {
    if (this.notificationsService) {
      await this.notificationsService.enqueueOrderStatus(
        result.orderId,
        result.userId,
        result.toStatus,
        result.orderNumber,
        shippingMeta,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
      select: { email: true, firstName: true, lastName: true },
    });
    const order = await this.prisma.order.findUnique({
      where: { id: result.orderId },
      select: { totalAmount: true, currency: true },
    });
    if (user?.email) {
      const event = this.emailEventForStatus(result.toStatus);
      if (event) {
        await this.emailOutbox.enqueueOrderEmail({
          event,
          toEmail: user.email,
          customerName: `${user.firstName} ${user.lastName}`.trim(),
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          status: result.toStatus,
          totalAmount: order
            ? `${order.totalAmount.toFixed(2)} ${order.currency}`
            : undefined,
          trackingUrl: shippingMeta?.trackingUrl ?? undefined,
        });
      }
    }
  }

  private emailEventForStatus(status: OrderStatus): string | null {
    switch (status) {
      case OrderStatus.CONFIRMED:
        return 'ORDER_CONFIRMED';
      case OrderStatus.PREPARING:
        return 'ORDER_CONFIRMED';
      case OrderStatus.SHIPPED:
        return 'ORDER_SHIPPED';
      case OrderStatus.DELIVERED:
        return 'ORDER_DELIVERED';
      case OrderStatus.CANCELLED:
        return 'ORDER_CANCELLED';
      case OrderStatus.RETURNED:
        return 'ORDER_CANCELLED';
      default:
        return null;
    }
  }

  private buildAdminWhere(
    query: AdminOrderListQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.payments = { some: { status: query.paymentStatus } };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q, mode: 'insensitive' } } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const dateKey = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
    ].join('');

    await tx.orderNumberSequence.upsert({
      where: { dateKey },
      create: { dateKey, lastValue: 0 },
      update: {},
    });

    const updated = await tx.$queryRaw<Array<{ lastValue: number }>>`
      UPDATE order_number_sequences
      SET "lastValue" = "lastValue" + 1
      WHERE "dateKey" = ${dateKey}
      RETURNING "lastValue"
    `;

    const seq = updated[0]?.lastValue;
    if (!seq) {
      throw new ConflictException('Unable to allocate order number');
    }

    return `FS-${dateKey}-${String(seq).padStart(6, '0')}`;
  }
}
