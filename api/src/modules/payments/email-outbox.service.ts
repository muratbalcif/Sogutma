import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxStatus, Prisma } from '@prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { renderOrderEmailHtml } from './email-templates';

type SendResult =
  { ok: true } | { ok: false; error: string; retryable: boolean };

/** How long a PROCESSING claim is exclusive before another worker may reclaim. */
const CLAIM_LEASE_MS = 5 * 60 * 1000;

/**
 * Email delivery is intentionally outside order/payment DB transactions.
 * Rows are claimed atomically (status → PROCESSING) so multi-instance
 * workers cannot double-send. processedAt is set only after successful send.
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
        status: OutboxStatus.PENDING,
        availableAt: new Date(),
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
    const now = new Date();
    const pending = await this.prisma.emailOutbox.findMany({
      where: {
        processedAt: null,
        attempts: { lt: this.maxAttempts },
        OR: [
          {
            status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
            availableAt: { lte: now },
          },
          {
            // Stale claim lease — previous worker likely died mid-send.
            status: OutboxStatus.PROCESSING,
            availableAt: { lte: now },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const item of pending) {
      const claimed = await this.claim(item.id, now);
      if (!claimed) {
        continue;
      }

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
          html: html ?? `<p>${item.subject}</p><p>Event: ${item.event}</p>`,
        });

        if (result.ok) {
          await this.prisma.emailOutbox.update({
            where: { id: item.id },
            data: {
              status: OutboxStatus.SENT,
              processedAt: new Date(),
              attempts: { increment: 1 },
              lastError: null,
            },
          });
          processed += 1;
          continue;
        }

        await this.markFailed(item.id, item.attempts + 1, result.error);
        this.logger.warn(
          `Email outbox ${item.id} not delivered (attempt ${item.attempts + 1}): ${result.error}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown email error';
        await this.markFailed(item.id, item.attempts + 1, message);
        this.logger.warn(
          `Email outbox ${item.id} failed (attempt ${item.attempts + 1}): ${message}`,
        );
      }
    }
    return processed;
  }

  /**
   * Atomic exclusive claim. Returns false if another worker already owns the row.
   */
  async claim(id: string, now = new Date()): Promise<boolean> {
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const claimed = await this.prisma.emailOutbox.updateMany({
      where: {
        id,
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
    return claimed.count === 1;
  }

  private async markFailed(
    id: string,
    attempts: number,
    error: string,
  ): Promise<void> {
    const backoffMs = Math.min(60_000 * attempts, 15 * 60_000);
    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.FAILED,
        attempts,
        lastError: error.slice(0, 500),
        availableAt: new Date(Date.now() + backoffMs),
        processedAt: null,
      },
    });
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
