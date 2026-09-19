import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notificationPreference: { upsert: jest.fn() },
    notification: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    deviceToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    productAlert: { findMany: jest.fn(), update: jest.fn() },
    product: { findUnique: jest.fn() },
    notificationOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const pushProvider = {
    enabled: false,
    sendToTokens: jest.fn().mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    }),
  };

  const config = { get: jest.fn().mockReturnValue(4) };

  const service = new NotificationsService(
    prisma as never,
    pushProvider as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notificationPreference.upsert.mockResolvedValue({
      orderNotifications: true,
      paymentNotifications: true,
      stockAlerts: true,
      campaignNotifications: true,
      systemNotifications: true,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      marketingEmailOptIn: false,
    });
    prisma.deviceToken.findMany.mockResolvedValue([]);
  });

  it('creates notification and keeps it when push fails', async () => {
    pushProvider.sendToTokens.mockRejectedValueOnce(new Error('fcm down'));
    prisma.notification.create.mockResolvedValue({
      id: 'n1',
      type: NotificationType.ORDER_CONFIRMED,
      title: 't',
      body: 'b',
      data: null,
      readAt: null,
      createdAt: new Date(),
    });

    const result = await service.createNotification({
      userId: 'u1',
      type: NotificationType.ORDER_CONFIRMED,
      title: 't',
      body: 'b',
    });
    expect(result.id).toBe('n1');
  });

  it('marks read only for owner', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'other',
      type: NotificationType.SYSTEM,
      title: 't',
      body: 'b',
      data: null,
      readAt: null,
      createdAt: new Date(),
    });
    await expect(service.markAsRead('u1', 'n1')).rejects.toThrow();
  });

  it('registers device token for authenticated user', async () => {
    prisma.deviceToken.findUnique.mockResolvedValue(null);
    prisma.deviceToken.upsert.mockResolvedValue({
      id: 'd1',
      token: 'token-abc-1234567890',
      platform: 'ANDROID',
      active: true,
      lastSeenAt: new Date(),
    });
    const device = await service.registerDevice('u1', {
      token: 'token-abc-1234567890',
      platform: 'ANDROID',
    });
    expect(device.token).toBe('token-abc-1234567890');
  });

  it('idempotent notification by eventKey', async () => {
    const existing = {
      id: 'n1',
      type: NotificationType.ORDER_SHIPPED,
      title: 't',
      body: 'b',
      data: null,
      readAt: null,
      createdAt: new Date(),
    };
    prisma.notification.findUnique.mockResolvedValue(existing);
    const result = await service.createNotification({
      userId: 'u1',
      type: NotificationType.ORDER_SHIPPED,
      title: 't',
      body: 'b',
      eventKey: 'ORDER_SHIPPED:ORDER:o1',
    });
    expect(result.id).toBe('n1');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('outbox retry marks FAILED after max attempts', async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      {
        id: 'ob1',
        type: 'ORDER_SHIPPED',
        aggregateType: 'ORDER',
        aggregateId: 'o1',
        eventKey: 'ORDER_SHIPPED:ORDER:o1',
        payload: { userId: 'u1', title: 't', body: 'b' },
        attempts: 3,
        status: 'PENDING',
      },
    ]);
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findUnique.mockResolvedValue(null);
    prisma.notification.create.mockRejectedValue(new Error('db down'));

    const processed = await service.processPendingOutbox(10);
    expect(processed).toBe(0);
    expect(prisma.notificationOutbox.update).toHaveBeenCalled();
  });

  it('skips push when pushEnabled is false but still creates in-app', async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({
      orderNotifications: true,
      paymentNotifications: true,
      stockAlerts: true,
      campaignNotifications: true,
      systemNotifications: true,
      emailEnabled: true,
      pushEnabled: false,
      inAppEnabled: true,
      marketingEmailOptIn: false,
    });
    prisma.notification.create.mockResolvedValue({
      id: 'n2',
      type: NotificationType.CAMPAIGN,
      title: 'c',
      body: 'b',
      data: null,
      readAt: null,
      createdAt: new Date(),
    });
    await service.createNotification({
      userId: 'u1',
      type: NotificationType.CAMPAIGN,
      title: 'c',
      body: 'b',
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(pushProvider.sendToTokens).not.toHaveBeenCalled();
  });
});
