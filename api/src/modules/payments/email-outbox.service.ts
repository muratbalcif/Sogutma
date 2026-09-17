import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Email delivery is intentionally outside order/payment DB transactions.
 * Current implementation records outbox rows and marks them processed after a
 * best-effort send (log stub until Resend/SMTP is configured).
 */
@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

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
