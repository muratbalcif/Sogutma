import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DevicePlatform,
  NotificationType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeviceTokenResponseDto,
  NotificationListQueryDto,
  NotificationResponseDto,
  RegisterDeviceDto,
} from './dto/notification.dto';
import { FcmPushProvider } from './providers/fcm-push.provider';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProvider: FcmPushProvider,
  ) {}

  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceTokenResponseDto> {
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: dto.token },
    });
    if (existing && existing.userId !== userId) {
      // Re-associate token to the authenticated user (device ownership change)
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
  }): Promise<NotificationResponseDto> {
    // Persistence is always the source of truth; preferences only gate push.
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    const prefs = await this.ensurePreferences(input.userId);
    if (this.isAllowedByPreference(prefs, input.type)) {
      await this.deliverPush(input.userId, {
        title: input.title,
        body: input.body,
        data: this.toStringData(input.data),
      });
    }

    return this.toNotificationResponse(notification);
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
    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count(),
      this.prisma.notification.findMany({
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

  async getAdminById(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.toNotificationResponse(notification);
  }

  async enqueueOrderStatus(
    orderId: string,
    userId: string,
    status: OrderStatus,
    orderNumber: string,
  ): Promise<void> {
    const type = this.mapOrderStatus(status);
    if (!type) {
      return;
    }
    await this.prisma.notificationOutbox.create({
      data: {
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
        },
      },
    });
    await this.processPendingOutbox(20);
  }

  async notifyProductBackInStock(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
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
      await this.createNotification({
        userId: alert.userId,
        type: NotificationType.PRODUCT_BACK_IN_STOCK,
        title: 'Ürün stokta',
        body: `${product.name} tekrar stokta`,
        data: { productId, alertId: alert.id },
      });
      await this.prisma.productAlert.update({
        where: { id: alert.id },
        data: { active: false, triggeredAt: now },
      });
    }
  }

  async processPendingOutbox(limit = 50): Promise<number> {
    const pending = await this.prisma.notificationOutbox.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const item of pending) {
      try {
        const payload = item.payload as {
          userId?: string;
          title?: string;
          body?: string;
          orderId?: string;
          orderNumber?: string;
          campaignId?: string;
        };

        if (item.type.startsWith('ORDER_') && payload.userId) {
          await this.createNotification({
            userId: payload.userId,
            type: item.type as NotificationType,
            title: payload.title ?? 'Sipariş güncellemesi',
            body: payload.body ?? '',
            data: {
              orderId: payload.orderId,
              orderNumber: payload.orderNumber,
            },
          });
        } else if (item.type === 'CAMPAIGN_ANNOUNCE' && payload.campaignId) {
          // Controlled foundation: do not fan-out to all users here.
          this.logger.log(
            `Campaign announce outbox processed for ${payload.campaignId} (no mass send)`,
          );
        }

        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: { processedAt: new Date(), attempts: { increment: 1 } },
        });
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown outbox error';
        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            lastError: message.slice(0, 500),
          },
        });
        this.logger.warn(`Outbox ${item.id} failed: ${message}`);
      }
    }
    return processed;
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
    if (type.startsWith('ORDER_')) return prefs.orderNotifications;
    if (type.startsWith('PAYMENT_')) return prefs.paymentNotifications;
    if (type === NotificationType.PRODUCT_BACK_IN_STOCK)
      return prefs.stockAlerts;
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
      default:
        return null;
    }
  }

  private orderTitle(status: OrderStatus, orderNumber: string): string {
    return `Sipariş ${orderNumber}: ${status}`;
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
    readAt: Date | null;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: (notification.data as Record<string, unknown> | null) ?? null,
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
