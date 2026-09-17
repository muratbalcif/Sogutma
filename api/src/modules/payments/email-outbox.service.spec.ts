import { OutboxStatus } from '@prisma/client';
import { EmailOutboxService } from './email-outbox.service';

describe('EmailOutboxService', () => {
  const prisma = {
    emailOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'SITE_NAME') return 'FurkanSoğutma';
      if (key === 'SITE_SUPPORT_EMAIL') return 'info@example.com';
      if (key === 'CORS_ORIGINS') return 'https://example.com';
      return undefined;
    }),
  };

  let service: EmailOutboxService;
  const fetchMock = jest.fn();

  const pendingRow = {
    id: 'e1',
    event: 'ORDER_CREATED',
    toEmail: 'a@b.com',
    subject: 'Hello',
    payload: { html: '<p>Hi</p>' },
    attempts: 0,
    processedAt: null,
    status: OutboxStatus.PENDING,
    availableAt: new Date(0),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'SITE_NAME') return 'FurkanSoğutma';
      if (key === 'SITE_SUPPORT_EMAIL') return 'info@example.com';
      if (key === 'CORS_ORIGINS') return 'https://example.com';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);
    prisma.emailOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailOutbox.update.mockResolvedValue({});
  });

  it('does not set processedAt when email provider is not configured', async () => {
    prisma.emailOutbox.findMany.mockResolvedValue([{ ...pendingRow }]);

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
    expect(prisma.emailOutbox.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processedAt: expect.any(Date) }),
      }),
    );
  });

  it('marks processedAt only after successful Resend send', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany.mockResolvedValue([
      { ...pendingRow, id: 'e2', attempts: 1 },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'msg_1' }),
    });

    const processed = await service.processPending(10);

    expect(processed).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e2' },
      data: {
        status: OutboxStatus.SENT,
        processedAt: expect.any(Date),
        attempts: { increment: 1 },
        lastError: null,
      },
    });
  });

  it('keeps retry state when Resend returns error', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany.mockResolvedValue([
      { ...pendingRow, id: 'e3', attempts: 2 },
    ]);
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
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);
    prisma.emailOutbox.findMany.mockResolvedValue([{ ...pendingRow }]);
    prisma.emailOutbox.updateMany.mockResolvedValue({ count: 0 });
    const sendSpy = jest.spyOn(service, 'sendEmail');

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(prisma.emailOutbox.update).not.toHaveBeenCalled();
  });

  it('concurrency: only one of two workers sends the same row', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') return 8;
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'noreply@example.com';
      return undefined;
    });
    service = new EmailOutboxService(prisma as never, config as never);

    prisma.emailOutbox.findMany.mockResolvedValue([{ ...pendingRow, id: 'e-race' }]);

    let claimCount = 0;
    prisma.emailOutbox.updateMany.mockImplementation(async () => {
      claimCount += 1;
      return { count: claimCount === 1 ? 1 : 0 };
    });

    let releaseSend!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const sendSpy = jest.spyOn(service, 'sendEmail').mockImplementation(async () => {
      await gate;
      return { ok: true };
    });

    const runA = service.processPending(10);
    const runB = service.processPending(10);
    // Allow both loops to race through claim before send completes.
    await Promise.resolve();
    releaseSend();
    const [a, b] = await Promise.all([runA, runB]);

    expect(a + b).toBe(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e-race' },
      data: expect.objectContaining({
        status: OutboxStatus.SENT,
        processedAt: expect.any(Date),
      }),
    });
  });
});
