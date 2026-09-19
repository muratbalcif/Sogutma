import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DevicePlatform,
  NotificationEntityType,
  NotificationType,
  OrderStatus,
  OutboxStatus,
  Prisma,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeviceTokenResponseDto,
  NotificationListQueryDto,
  NotificationResponseDto,
  RegisterDeviceDto,
} from './dto/notification.dto';
import { FcmPushProvider } from './providers/fcm-push.provider';

const CRITICAL_TYPES = new Set<NotificationType>([
  NotificationType.ORDER_CANCELLED,
  NotificationType.ORDER_CONFIRMED,
  NotificationType.ORDER_SHIPPED,
  NotificationType.ORDER_DELIVERED,
  NotificationType.PAYMENT_APPROVED,
  NotificationType.PAYMENT_REJECTED,
  NotificationType.PAYMENT_PAID,
  NotificationType.BANK_TRANSFER_APPROVED,
  NotificationType.BANK_TRANSFER_REJECTED,
]);

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProvider: FcmPushProvider,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxAttempts =
      this.config.get('NOTIFICATION_OUTBOX_MAX_ATTEMPTS', { infer: true }) ?? 4;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPendingOutbox(50);
    }, 30 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceTokenResponseDto> {
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: dto.token },
    });
    if (existing && existing.userId !== userId) {
      const updated = await this.prisma.deviceToken.update({
        where: { token: dto.token },
        data: {
          userId,
          platform: dto.platform,
          active: true,
          lastSeenAt: new Date(),
        },
      });
      return this.toDeviceResponse(updated);
    }

    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        active: true,
        lastSeenAt: new Date(),
      },
      update: {
        platform: dto.platform,
        active: true,
        lastSeenAt: new Date(),
      },
    });
    return this.toDeviceResponse(device);
  }

  async listDevices(userId: string): Promise<DeviceTokenResponseDto[]> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map((d) => this.toDeviceResponse(d));
  }

  async deactivateDevice(
    userId: string,
    token: string,
  ): Promise<{ success: true }> {
    const device = await this.prisma.deviceToken.findUnique({
      where: { token },
    });
    if (!device || device.userId !== userId) {
      throw new ForbiddenException('Device token not found for user');
    }
    await this.prisma.deviceToken.update({
      where: { token },
      data: { active: false },
    });
    return { success: true };
  }

  async createNotification(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    entityType?: NotificationEntityType;
    entityId?: string;
    eventKey?: string;
  }): Promise<NotificationResponseDto> {
    if (input.eventKey) {
      const existing = await this.prisma.notification.findUnique({
        where: { eventKey: input.eventKey },
      });
      if (existing) {
        return this.toNotificationResponse(existing);
      }
    }

    try {
      const prefs = await this.ensurePreferences(input.userId);
      const allowInApp =
        CRITICAL_TYPES.has(input.type) ||
        (prefs.inAppEnabled && this.isAllowedByPreference(prefs, input.type));

      if (!allowInApp) {
        this.logger.debug(
          `notification.skipped channel=in_app type=${input.type} userId=${input.userId}`,
        );
        // Still attempt push if enabled — channels are independent.
      }

      let notification =
        allowInApp
          ? await this.prisma.notification.create({
              data: {
                userId: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                entityType: input.entityType,
                entityId: input.entityId,
                eventKey: input.eventKey,
              },
            })
          : null;

      if (notification) {
        this.logger.log(
          `notification.created channel=in_app type=${input.type} id=${notification.id}`,
        );
      }

      // Push is best-effort and never part of order transactions.
      const allowPush =
        prefs.pushEnabled &&
        (CRITICAL_TYPES.has(input.type) ||
          this.isAllowedByPreference(prefs, input.type));
      if (allowPush) {
        await this.deliverPush(input.userId, {
          title: input.title,
          body: input.body,
          data: this.toStringData({
            ...input.data,
            entityType: input.entityType,
            entityId: input.entityId,
            type: input.type,
            eventKey: input.eventKey,
          }),
        });
      }

      if (!notification) {
        // Preference filtered in-app: return a synthetic read-only shape for callers.
        return {
          id: input.eventKey ?? 'skipped',
          type: input.type,
          title: input.title,
          body: input.body,
          message: input.body,
          data: input.data ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          readAt: new Date(),
          createdAt: new Date(),
        };
      }

      return this.toNotificationResponse(notification);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.eventKey
      ) {
        const existing = await this.prisma.notification.findUnique({
          where: { eventKey: input.eventKey },
        });
        if (existing) {
          return this.toNotificationResponse(existing);
        }
      }
      throw error;
    }
  }

  async getPreferences(userId: string) {
    return this.ensurePreferences(userId);
  }

  async updatePreferences(
    userId: string,
    dto: {
      orderNotifications?: boolean;
      paymentNotifications?: boolean;
      stockAlerts?: boolean;
      campaignNotifications?: boolean;
      systemNotifications?: boolean;
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      marketingEmailOptIn?: boolean;
    },
  ) {
    await this.ensurePreferences(userId);
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        orderNotifications: dto.orderNotifications,
        paymentNotifications: dto.paymentNotifications,
        stockAlerts: dto.stockAlerts,
        campaignNotifications: dto.campaignNotifications,
        systemNotifications: dto.systemNotifications,
        emailEnabled: dto.emailEnabled,
        pushEnabled: dto.pushEnabled,
        inAppEnabled: dto.inAppEnabled,
        marketingEmailOptIn: dto.marketingEmailOptIn,
      },
    });
  }

  async listForUser(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return buildPaginatedResponse(
      items.map((item) => this.toNotificationResponse(item)),
      total,
      page,
      limit,
    );
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Notification does not belong to user');
    }
    if (notification.readAt) {
      return this.toNotificationResponse(notification);
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return this.toNotificationResponse(updated);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async listAdmin(query: NotificationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.eventKey
        ? { eventKey: { contains: query.eventKey, mode: 'insensitive' } }
        : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return buildPaginatedResponse(
      items.map((item) => this.toNotificationResponse(item)),
      total,
      page,
      limit,
    );
  }

  async adminSummary(): Promise<{
    pendingOutbox: number;
    sentToday: number;
    failedToday: number;
    retrying: number;
    inAppTotal: number;
    pushDevicesActive: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();
    const [
      pendingOutbox,
      sentToday,
      failedToday,
      retrying,
      inAppTotal,
      pushDevicesActive,
    ] = await Promise.all([
      this.prisma.notificationOutbox.count({
        where: {
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
          processedAt: null,
        },
      }),
      this.prisma.notificationOutbox.count({
        where: { status: OutboxStatus.SENT, processedAt: { gte: startOfDay } },
      }),
      this.prisma.notificationOutbox.count({
        where: {
          status: OutboxStatus.FAILED,
          attempts: { gte: this.maxAttempts },
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.notificationOutbox.count({
        where: {
          status: OutboxStatus.FAILED,
          processedAt: null,
          attempts: { lt: this.maxAttempts },
          availableAt: { gt: now },
        },
      }),
      this.prisma.notification.count(),
      this.prisma.deviceToken.count({ where: { active: true } }),
    ]);
    return {
      pendingOutbox,
      sentToday,
      failedToday,
      retrying,
      inAppTotal,
      pushDevicesActive,
    };
  }

  async getAdminById(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.toNotificationResponse(notification);
  }

  async notifyOrderCreated(
    orderId: string,
    userId: string,
    orderNumber: string,
  ): Promise<void> {
    await this.enqueueOutbox({
      type: NotificationType.ORDER_CREATED,
      aggregateType: 'ORDER',
      aggregateId: orderId,
      payload: {
        userId,
        orderId,
        orderNumber,
        title: `Sipariş oluşturuldu — ${orderNumber}`,
        body: `${orderNumber} siparişiniz alındı. Ödeme bekleniyor.`,
        entityType: NotificationEntityType.ORDER,
        entityId: orderId,
      },
    });
  }

  async notifyPaymentPending(
    orderId: string,
    userId: string,
    orderNumber: string,
  ): Promise<void> {
    await this.enqueueOutbox({
      type: NotificationType.PAYMENT_PENDING,
      aggregateType: 'PAYMENT',
      aggregateId: orderId,
      payload: {
        userId,
        orderId,
        orderNumber,
        title: `Ödeme bekleniyor — ${orderNumber}`,
        body: `${orderNumber} için havale/EFT ödemesini tamamlayın.`,
        entityType: NotificationEntityType.PAYMENT,
        entityId: orderId,
      },
    });
  }

  async enqueueOrderStatus(
    orderId: string,
    userId: string,
    status: OrderStatus,
    orderNumber: string,
    shippingMeta?: { trackingNumber?: string; trackingUrl?: string | null },
  ): Promise<void> {
    const type = this.mapOrderStatus(status);
    if (!type) {
      return;
    }
    await this.enqueueOutbox({
      type,
      aggregateType: 'ORDER',
      aggregateId: orderId,
      payload: {
        userId,
        orderId,
        orderNumber,
        status,
        title: this.orderTitle(status, orderNumber),
        body: this.orderBody(status, orderNumber),
        entityType: NotificationEntityType.ORDER,
        entityId: orderId,
        trackingNumber: shippingMeta?.trackingNumber,
        trackingUrl: shippingMeta?.trackingUrl,
      },
    });
  }

  async enqueuePaymentEvent(input: {
    userId: string;
    type:
      | 'BANK_TRANSFER_SUBMITTED'
      | 'BANK_TRANSFER_APPROVED'
      | 'BANK_TRANSFER_REJECTED'
      | 'PAYMENT_PAID'
      | 'PAYMENT_FAILED'
      | 'PAYMENT_APPROVED'
      | 'PAYMENT_REJECTED'
      | 'PAYMENT_PENDING';
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const aggregateId =
      (typeof input.data?.transferId === 'string'
        ? input.data.transferId
        : undefined) ??
      (typeof input.data?.paymentId === 'string'
        ? input.data.paymentId
        : undefined) ??
      (typeof input.data?.orderId === 'string'
        ? input.data.orderId
        : undefined) ??
      input.userId;

    await this.enqueueOutbox({
      type: input.type,
      aggregateType: 'PAYMENT',
      aggregateId,
      payload: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        entityType: NotificationEntityType.PAYMENT,
        entityId: aggregateId,
        ...input.data,
      },
    });
  }

  async notifyProductBackInStock(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true },
    });
    if (!product) {
      return;
    }

    const alerts = await this.prisma.productAlert.findMany({
      where: { productId, active: true, triggeredAt: null },
      select: { id: true, userId: true },
    });
    if (alerts.length === 0) {
      return;
    }

    const now = new Date();
    for (const alert of alerts) {
      await this.enqueueOutbox({
        type: NotificationType.STOCK_AVAILABLE,
        aggregateType: 'PRODUCT',
        aggregateId: `${productId}:${alert.userId}`,
        payload: {
          userId: alert.userId,
          title: 'Ürün stokta',
          body: `${product.name} tekrar stokta`,
          entityType: NotificationEntityType.PRODUCT,
          entityId: productId,
          productId,
          productSlug: product.slug,
          alertId: alert.id,
        },
      });
      await this.prisma.productAlert.update({
        where: { id: alert.id },
        data: { active: false, triggeredAt: now },
      });
    }
  }

  private async enqueueOutbox(input: {
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const eventKey = `${input.type}:${input.aggregateType}:${input.aggregateId}`;
    try {
      await this.prisma.notificationOutbox.create({
        data: {
          type: input.type,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventKey,
          payload: input.payload as Prisma.InputJsonValue,
          status: OutboxStatus.PENDING,
          availableAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(`Outbox idempotent skip: ${eventKey}`);
        return;
      }
      throw error;
    }
    await this.processPendingOutbox(20);
  }

  async processPendingOutbox(limit = 50): Promise<number> {
    const now = new Date();
    const pending = await this.prisma.notificationOutbox.findMany({
      where: {
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED, OutboxStatus.PROCESSING] },
        processedAt: null,
        availableAt: { lte: now },
        attempts: { lt: this.maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const item of pending) {
      const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
      const claimed = await this.prisma.notificationOutbox.updateMany({
        where: {
          id: item.id,
          processedAt: null,
          OR: [
            { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
            { status: OutboxStatus.PROCESSING, availableAt: { lte: now } },
          ],
        },
        data: {
          status: OutboxStatus.PROCESSING,
          availableAt: leaseUntil,
        },
      });
      if (claimed.count === 0) {
        continue;
      }

      this.logger.log(
        `notification.processing channel=outbox id=${item.id} type=${item.type}`,
      );

      try {
        const payload = item.payload as {
          userId?: string;
          title?: string;
          body?: string;
          orderId?: string;
          orderNumber?: string;
          campaignId?: string;
          entityType?: NotificationEntityType;
          entityId?: string;
          productId?: string;
          productSlug?: string;
          trackingUrl?: string;
          trackingNumber?: string;
        };

        if (payload.userId) {
          await this.createNotification({
            userId: payload.userId,
            type: item.type as NotificationType,
            title: payload.title ?? 'Bildirim',
            body: payload.body ?? '',
            entityType: payload.entityType,
            entityId: payload.entityId ?? item.aggregateId,
            eventKey: item.eventKey ?? undefined,
            data: {
              orderId: payload.orderId,
              orderNumber: payload.orderNumber,
              productId: payload.productId,
              productSlug: payload.productSlug,
              trackingUrl: payload.trackingUrl,
              trackingNumber: payload.trackingNumber,
              entityType: payload.entityType ?? item.aggregateType,
              entityId: payload.entityId ?? item.aggregateId,
              deepLink: this.buildDeepLink(payload),
            },
          });
        } else if (item.type === 'CAMPAIGN_ANNOUNCE' && payload.campaignId) {
          this.logger.log(
            `Campaign announce outbox processed for ${payload.campaignId} (no mass send)`,
          );
        }

        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: OutboxStatus.SENT,
            processedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        this.logger.log(
          `notification.sent channel=outbox id=${item.id} type=${item.type}`,
        );
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown outbox error';
        const attempts = item.attempts + 1;
        const failed = attempts >= this.maxAttempts;
        const backoffMs = this.outboxBackoffMs(attempts);
        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: failed ? OutboxStatus.FAILED : OutboxStatus.FAILED,
            attempts,
            lastError: message.slice(0, 500),
            availableAt: failed ? now : new Date(Date.now() + backoffMs),
            processedAt: null,
          },
        });
        this.logger.warn(
          failed
            ? `notification.failed channel=outbox id=${item.id} attempts=${attempts}`
            : `notification.retrying channel=outbox id=${item.id} attempts=${attempts}`,
        );
      }
    }
    return processed;
  }

  private outboxBackoffMs(attempts: number): number {
    const minutes = [1, 5, 15, 30, 60] as const;
    const idx = Math.min(Math.max(attempts - 1, 0), minutes.length - 1);
    return minutes[idx] * 60_000;
  }

  private buildDeepLink(payload: {
    orderId?: string;
    productId?: string;
    productSlug?: string;
    entityType?: NotificationEntityType;
    entityId?: string;
  }): string | undefined {
    if (payload.orderId) {
      return `/account/orders/${payload.orderId}`;
    }
    if (payload.productSlug) {
      return `/products/${payload.productSlug}`;
    }
    if (payload.productId) {
      return `/products/${payload.productId}`;
    }
    return undefined;
  }

  private async deliverPush(
    userId: string,
    message: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    try {
      const devices = await this.prisma.deviceToken.findMany({
        where: { userId, active: true },
        select: { token: true },
      });
      const tokens = devices.map((d) => d.token);
      const result = await this.pushProvider.sendToTokens(tokens, message);
      if (result.invalidTokens.length > 0) {
        await this.prisma.deviceToken.updateMany({
          where: { token: { in: result.invalidTokens } },
          data: { active: false },
        });
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'push failure';
      this.logger.warn(
        `Push delivery failed (notification kept): ${messageText}`,
      );
    }
  }

  private async ensurePreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private isAllowedByPreference(
    prefs: {
      orderNotifications: boolean;
      paymentNotifications: boolean;
      stockAlerts: boolean;
      campaignNotifications: boolean;
      systemNotifications: boolean;
    },
    type: NotificationType,
  ): boolean {
    if (type.startsWith('ORDER_') || type === NotificationType.ORDER_RETURNED) {
      return prefs.orderNotifications;
    }
    if (type.startsWith('PAYMENT_') || type.startsWith('BANK_TRANSFER_')) {
      return prefs.paymentNotifications;
    }
    if (
      type === NotificationType.PRODUCT_BACK_IN_STOCK ||
      type === NotificationType.STOCK_AVAILABLE
    ) {
      return prefs.stockAlerts;
    }
    if (type === NotificationType.CAMPAIGN) return prefs.campaignNotifications;
    if (type === NotificationType.SYSTEM) return prefs.systemNotifications;
    return true;
  }

  private mapOrderStatus(status: OrderStatus): NotificationType | null {
    switch (status) {
      case OrderStatus.PENDING:
        return NotificationType.ORDER_CREATED;
      case OrderStatus.CONFIRMED:
        return NotificationType.ORDER_CONFIRMED;
      case OrderStatus.PREPARING:
        return NotificationType.ORDER_PREPARING;
      case OrderStatus.SHIPPED:
        return NotificationType.ORDER_SHIPPED;
      case OrderStatus.DELIVERED:
        return NotificationType.ORDER_DELIVERED;
      case OrderStatus.CANCELLED:
        return NotificationType.ORDER_CANCELLED;
      case OrderStatus.RETURNED:
        return NotificationType.ORDER_RETURNED;
      default:
        return null;
    }
  }

  private orderTitle(status: OrderStatus, orderNumber: string): string {
    const labels: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.CONFIRMED]: 'Sipariş onaylandı',
      [OrderStatus.PREPARING]: 'Sipariş hazırlanıyor',
      [OrderStatus.SHIPPED]: 'Sipariş kargoda',
      [OrderStatus.DELIVERED]: 'Sipariş teslim edildi',
      [OrderStatus.CANCELLED]: 'Sipariş iptal edildi',
      [OrderStatus.RETURNED]: 'İade başlatıldı',
    };
    return `${labels[status] ?? 'Sipariş güncellendi'} — ${orderNumber}`;
  }

  private orderBody(status: OrderStatus, orderNumber: string): string {
    return `Siparişiniz ${orderNumber} durumu ${status} olarak güncellendi.`;
  }

  private toStringData(
    data?: Record<string, unknown>,
  ): Record<string, string> | undefined {
    if (!data) return undefined;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
      ) {
        result[key] = String(value);
      } else {
        result[key] = JSON.stringify(value);
      }
    }
    return result;
  }

  private toNotificationResponse(notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Prisma.JsonValue;
    entityType?: NotificationEntityType | null;
    entityId?: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      message: notification.body,
      data: (notification.data as Record<string, unknown> | null) ?? null,
      entityType: notification.entityType ?? null,
      entityId: notification.entityId ?? null,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  private toDeviceResponse(device: {
    id: string;
    token: string;
    platform: DevicePlatform;
    active: boolean;
    lastSeenAt: Date;
  }): DeviceTokenResponseDto {
    return {
      id: device.id,
      token: device.token,
      platform: device.platform,
      active: device.active,
      lastSeenAt: device.lastSeenAt,
    };
  }
}
