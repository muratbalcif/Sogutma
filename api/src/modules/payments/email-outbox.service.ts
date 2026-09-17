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

type SendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

/**
 * Email delivery is intentionally outside order/payment DB transactions.
 * Rows are only marked processed after a successful provider send.
 * Without RESEND_API_KEY + EMAIL_FROM, delivery fails (retryable) and
 * processedAt is never set.
 */
@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxAttempts =
      this.config.get('EMAIL_OUTBOX_MAX_ATTEMPTS', { infer: true }) ?? 8;
  }

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

  isProviderConfigured(): boolean {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('EMAIL_FROM', { infer: true });
    return Boolean(apiKey?.trim() && from?.trim());
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
      where: {
        processedAt: null,
        attempts: { lt: this.maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const item of pending) {
      const html =
        item.payload &&
        typeof item.payload === 'object' &&
        'html' in item.payload &&
        typeof (item.payload as { html?: unknown }).html === 'string'
          ? (item.payload as { html: string }).html
          : undefined;

      try {
        const result = await this.sendEmail({
          to: item.toEmail,
          subject: item.subject,
          html:
            html ??
            `<p>${item.subject}</p><p>Event: ${item.event}</p>`,
        });

        if (result.ok) {
          await this.prisma.emailOutbox.update({
            where: { id: item.id },
            data: {
              processedAt: new Date(),
              attempts: item.attempts + 1,
              lastError: null,
            },
          });
          processed += 1;
          continue;
        }

        await this.prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            attempts: item.attempts + 1,
            lastError: result.error.slice(0, 500),
          },
        });
        this.logger.warn(
          `Email outbox ${item.id} not delivered (attempt ${item.attempts + 1}): ${result.error}`,
        );
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
        this.logger.warn(
          `Email outbox ${item.id} failed (attempt ${item.attempts + 1}): ${message}`,
        );
      }
    }
    return processed;
  }

  /** Exposed for tests — sends via Resend when configured. */
  async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
  }): Promise<SendResult> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true })?.trim();
    const from = this.config.get('EMAIL_FROM', { infer: true })?.trim();

    if (!apiKey || !from) {
      return {
        ok: false,
        error: 'Email provider not configured (RESEND_API_KEY / EMAIL_FROM)',
        retryable: true,
      };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: `Resend HTTP ${response.status}: ${text.slice(0, 300)}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }

    return { ok: true };
  }
}
