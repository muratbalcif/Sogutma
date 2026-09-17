import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { renderOrderEmailHtml } from './email-templates';

/**
 * Email delivery is intentionally outside order/payment DB transactions.
 * Current implementation records outbox rows and marks them processed after a
 * best-effort send (log stub until Resend/SMTP is configured).
 */
@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPending(30);
    }, 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async enqueue(input: {
    event: string;
    toEmail: string;
    subject: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.emailOutbox.create({
      data: {
        event: input.event,
        toEmail: input.toEmail,
        subject: input.subject,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  async enqueueOrderEmail(input: {
    event: string;
    toEmail: string;
    customerName: string;
    orderId: string;
    orderNumber: string;
    status: string;
    totalAmount?: string;
    trackingUrl?: string;
  }): Promise<void> {
    const siteName =
      this.config.get('SITE_NAME', { infer: true }) || 'FurkanSoğutma';
    const support =
      this.config.get('SITE_SUPPORT_EMAIL', { infer: true }) || undefined;
    const webBase =
      this.config.get('CORS_ORIGINS', { infer: true })?.split(',')[0]?.trim() ||
      'https://furkansogutma.com';
    const actionUrl = `${webBase.replace(/\/$/, '')}/account/orders/${input.orderId}`;
    const html = renderOrderEmailHtml({
      customerName: input.customerName,
      orderNumber: input.orderNumber,
      status: input.status,
      totalAmount: input.totalAmount,
      actionUrl,
      trackingUrl: input.trackingUrl,
      supportEmail: support,
      websiteUrl: webBase,
    });

    await this.enqueue({
      event: input.event,
      toEmail: input.toEmail,
      subject: `${siteName} — ${input.orderNumber}: ${input.status}`,
      payload: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        status: input.status,
        html,
        customerName: input.customerName,
        totalAmount: input.totalAmount,
        trackingUrl: input.trackingUrl,
      },
    });
  }

  async processPending(limit = 30): Promise<number> {
    const pending = await this.prisma.emailOutbox.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const item of pending) {
      try {
        // Provider hook: replace with Resend/SMTP when credentials are present.
        this.logger.log(
          `[email:${item.event}] to=${item.toEmail} subject=${item.subject}`,
        );
        await this.prisma.emailOutbox.update({
          where: { id: item.id },
          data: { processedAt: new Date(), attempts: item.attempts + 1 },
        });
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown email error';
        await this.prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            attempts: item.attempts + 1,
            lastError: message.slice(0, 500),
          },
        });
      }
    }
    return processed;
  }
}
