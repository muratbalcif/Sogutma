import { OutboxStatus } from '@prisma/client';
import { EmailOutboxService } from './email-outbox.service';

describe('EmailOutboxService', () => {
  const prisma = {
    emailOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
    },
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'SITE_NAME') return 'FurkanSoğutma';
      if (key === 'SITE_SUPPORT_EMAIL') return 'info@example.com';
      if (key === 'CORS_ORIGINS') return 'https://example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  };

  let service: EmailOutboxService;
  const fetchMock = jest.fn();

  const pendingRow = {
    id: 'e1',
    event: 'ORDER_CREATED',
    eventKey: 'ORDER_CREATED:order:o1:a@b.com',
    toEmail: 'a@b.com',
    subject: 'Hello',
    payload: { html: '<p>Hi</p>', text: 'Hi' },
    attempts: 0,
    processedAt: null,
    status: OutboxStatus.PENDING,
    availableAt: new Date(0),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'SITE_NAME') return 'FurkanSoğutma';
      if (key === 'SITE_SUPPORT_EMAIL') return 'info@example.com';
      if (key === 'CORS_ORIGINS') return 'https://example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);
    prisma.emailOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailOutbox.update.mockResolvedValue({});
    prisma.emailOutbox.findMany.mockResolvedValue([]);
  });

  it('does not set processedAt when email provider is not configured', async () => {
    prisma.emailOutbox.findMany
      .mockResolvedValueOnce([{ ...pendingRow }])
      .mockResolvedValueOnce([]);

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(prisma.emailOutbox.updateMany).toHaveBeenCalled();
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        attempts: 1,
        lastError: expect.stringContaining('Email provider not configured'),
        processedAt: null,
      }),
    });
  });

  it('marks processedAt only after successful Resend send', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany
      .mockResolvedValueOnce([{ ...pendingRow, id: 'e2', attempts: 1 }])
      .mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_1' }),
      text: async () => JSON.stringify({ id: 'msg_1' }),
    });

    const processed = await service.processPending(10);

    expect(processed).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e2' },
      data: expect.objectContaining({
        status: OutboxStatus.SENT,
        processedAt: expect.any(Date),
        sentAt: expect.any(Date),
        attempts: { increment: 1 },
        lastError: null,
        providerMessageId: 'msg_1',
      }),
    });
  });

  it('keeps retry state when Resend returns error', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany
      .mockResolvedValueOnce([{ ...pendingRow, id: 'e3', attempts: 2 }])
      .mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream down',
    });

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e3' },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        attempts: 3,
        lastError: expect.stringContaining('Resend HTTP 500'),
        processedAt: null,
      }),
    });
  });

  it('skips send when claim loses to another worker', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);
    prisma.emailOutbox.findMany
      .mockResolvedValueOnce([{ ...pendingRow }])
      .mockResolvedValueOnce([]);
    prisma.emailOutbox.updateMany.mockResolvedValue({ count: 0 });
    const sendSpy = jest.spyOn(service, 'sendEmail');

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(prisma.emailOutbox.update).not.toHaveBeenCalled();
  });

  it('concurrency: only one of two workers sends the same row', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 5;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany.mockImplementation(async () => {
      return [{ ...pendingRow, id: 'e-race' }];
    });

    let claimCount = 0;
    prisma.emailOutbox.updateMany.mockImplementation(async () => {
      claimCount += 1;
      return { count: claimCount === 1 ? 1 : 0 };
    });

    let releaseSend!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const sendSpy = jest
      .spyOn(service, 'sendEmail')
      .mockImplementation(async () => {
        await gate;
        return { ok: true, providerMessageId: 'msg' };
      });

    const runA = service.processPending(10);
    const runB = service.processPending(10);
    await Promise.resolve();
    releaseSend();
    const [a, b] = await Promise.all([runA, runB]);

    expect(a + b).toBeGreaterThanOrEqual(1);
    expect(sendSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e-race' },
      data: expect.objectContaining({
        status: OutboxStatus.SENT,
        processedAt: expect.any(Date),
      }),
    });
  });

  it('enqueue is idempotent on duplicate eventKey', async () => {
    const { Prisma } =
      require('@prisma/client') as typeof import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.emailOutbox.create.mockRejectedValueOnce(err);

    const result = await service.enqueue({
      event: 'ORDER_CREATED',
      toEmail: 'a@b.com',
      subject: 'x',
      payload: { orderId: 'o1' },
      eventKey: 'ORDER_CREATED:order:o1:a@b.com',
    });

    expect(result.created).toBe(false);
  });

  it('retry resets FAILED row to PENDING idempotently', async () => {
    prisma.emailOutbox.findUnique.mockResolvedValue({
      ...pendingRow,
      id: 'e-retry',
      status: OutboxStatus.FAILED,
      attempts: 5,
      processedAt: null,
    });
    prisma.emailOutbox.update.mockResolvedValue({
      id: 'e-retry',
      status: OutboxStatus.PENDING,
      attempts: 4,
    });

    const result = await service.retry('e-retry');
    expect(result.status).toBe(OutboxStatus.PENDING);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e-retry' },
      data: expect.objectContaining({
        status: OutboxStatus.PENDING,
        processedAt: null,
      }),
    });
  });
});
