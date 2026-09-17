import {
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
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BankAccountsService } from '../payments/bank-accounts.service';
import { EmailOutboxService } from '../payments/email-outbox.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
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
    private readonly orderStatusService: OrderStatusService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly bankAccountsService: BankAccountsService,
    private readonly emailOutbox: EmailOutboxService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async create(
    userId: string,
    userType: UserType,
    dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
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
          const discountAmount = sumMoney(
            calculation.lines.map((line) => line.discountAmount),
          );
          const taxAmount = sumMoney(
            calculation.lines.map((line) => line.taxAmount),
          );
          const shippingAmount = new Prisma.Decimal(0);
          const totalAmount = sumMoney(
            calculation.lines.map((line) => line.totalAmount),
          ).add(shippingAmount);
          const currency = calculation.summary.currency;

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

          await tx.accountTransaction.create({
            data: {
              userId,
              orderId: order.id,
              type: AccountTransactionType.SALE,
              amount: totalAmount,
              currency,
              description: `Sale for order ${order.orderNumber}`,
              reference: `SALE:ORDER:${order.id}`,
            },
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
            },
          });

          if (cart) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          }

          return { orderId: order.id, orderNumber: order.orderNumber };
        },
        { timeout: 15000 },
      );

      if (this.notificationsService) {
        await this.notificationsService.enqueueOrderStatus(
          created.orderId,
          userId,
          OrderStatus.PENDING,
          created.orderNumber,
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) {
        await this.emailOutbox.enqueue({
          event: 'OrderCreated',
          toEmail: user.email,
          subject: `Siparişiniz oluşturuldu — ${created.orderNumber}`,
          payload: {
            orderId: created.orderId,
            orderNumber: created.orderNumber,
          },
        });
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
        include: orderDetailInclude,
      }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => mapOrderToResponse(order)),
      total,
      query.page,
      query.limit,
    );
  }

  async getByIdForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderDetailInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to user');
    }
    return mapOrderToResponse(order);
  }

  async cancelForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    await this.cancelOrder(orderId, {
      actorUserId: userId,
      requireOwner: userId,
      customerCancel: true,
    });
    return this.getByIdForUser(userId, orderId);
  }

  async listAdmin(
    query: PaginationQueryDto & { status?: OrderStatus },
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const where = query.status ? { status: query.status } : {};
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: orderDetailInclude,
      }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => mapOrderToResponse(order)),
      total,
      page,
      limit,
    );
  }

  async getAdminById(orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderDetailInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return mapOrderToResponse(order);
  }

  async updateStatusAdmin(
    orderId: string,
    adminUserId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const notify = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
      `;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      this.orderStatusService.assertTransition(order.status, dto.status);

      if (
        dto.status === OrderStatus.CANCELLED &&
        order.status !== OrderStatus.CANCELLED
      ) {
        await this.releaseOrderStock(tx, orderId, adminUserId);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: dto.status },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: dto.status,
          note: dto.note,
          changedBy: adminUserId,
        },
      });

      return {
        userId: order.userId,
        orderNumber: order.orderNumber,
        status: dto.status,
      };
    });

    if (this.notificationsService) {
      await this.notificationsService.enqueueOrderStatus(
        orderId,
        notify.userId,
        notify.status,
        notify.orderNumber,
      );
    }

    return this.getAdminById(orderId);
  }

  private async cancelOrder(
    orderId: string,
    options: {
      actorUserId: string;
      requireOwner?: string;
      customerCancel?: boolean;
    },
  ): Promise<void> {
    const notifyPayload = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
      `;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (options.requireOwner && order.userId !== options.requireOwner) {
        throw new ForbiddenException('Order does not belong to user');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Order is already cancelled');
      }
      if (options.customerCancel) {
        if (!this.orderStatusService.canCustomerCancel(order.status)) {
          throw new ConflictException(
            `Order cannot be cancelled from status ${order.status}`,
          );
        }
      } else {
        this.orderStatusService.assertTransition(
          order.status,
          OrderStatus.CANCELLED,
        );
      }

      await this.releaseOrderStock(tx, orderId, options.actorUserId);

      await tx.payment.updateMany({
        where: {
          orderId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          failureCode: 'ORDER_CANCELLED',
          failureMessage: 'Order cancelled',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          note: 'Order cancelled',
          changedBy: options.actorUserId,
        },
      });

      return {
        userId: order.userId,
        orderNumber: order.orderNumber,
      };
    });

    if (this.notificationsService) {
      await this.notificationsService.enqueueOrderStatus(
        orderId,
        notifyPayload.userId,
        OrderStatus.CANCELLED,
        notifyPayload.orderNumber,
      );
    }
  }

  private async releaseOrderStock(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorUserId: string,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId, productId: { not: null } },
    });

    for (const item of items) {
      if (!item.productId) {
        continue;
      }
      await this.inventoryService.releaseStockInTransaction(
        tx,
        item.productId,
        item.quantity,
        {
          createdBy: actorUserId,
          referenceType: 'ORDER',
          referenceId: orderId,
          note: 'Released on order cancellation',
        },
      );
    }
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
