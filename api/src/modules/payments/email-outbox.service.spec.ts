import { EmailOutboxService } from './email-outbox.service';

describe('EmailOutboxService', () => {
  const prisma = {
    emailOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new EmailOutboxService(prisma as never, config as never);
  });

  it('does not set processedAt when email provider is not configured', async () => {
    prisma.emailOutbox.findMany.mockResolvedValue([
      {
        id: 'e1',
        event: 'ORDER_CREATED',
        toEmail: 'a@b.com',
        subject: 'Hello',
        payload: { html: '<p>Hi</p>' },
        attempts: 0,
        processedAt: null,
      },
    ]);
    prisma.emailOutbox.update.mockResolvedValue({});

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        attempts: 1,
        lastError: expect.stringContaining('Email provider not configured'),
      },
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
      {
        id: 'e2',
        event: 'ORDER_CREATED',
        toEmail: 'a@b.com',
        subject: 'Hello',
        payload: { html: '<p>Hi</p>' },
        attempts: 1,
        processedAt: null,
      },
    ]);
    prisma.emailOutbox.update.mockResolvedValue({});
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
        processedAt: expect.any(Date),
        attempts: 2,
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
      {
        id: 'e3',
        event: 'ORDER_CREATED',
        toEmail: 'a@b.com',
        subject: 'Hello',
        payload: { html: '<p>Hi</p>' },
        attempts: 2,
        processedAt: null,
      },
    ]);
    prisma.emailOutbox.update.mockResolvedValue({});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream down',
    });

    const processed = await service.processPending(10);

    expect(processed).toBe(0);
    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'e3' },
      data: {
        attempts: 3,
        lastError: expect.stringContaining('Resend HTTP 500'),
      },
    });
  });
});
