import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProvider,
  ProviderPaymentStatus,
  VerifiedWebhookEvent,
  WebhookVerificationInput,
  DEVELOPMENT_PAYMENT_PROVIDER,
} from './payment-provider.interface';

/**
 * Development-only payment provider.
 * Never used for real card data. Webhook auth uses x-dev-webhook-secret.
 */
@Injectable()
export class DevelopmentPaymentProvider implements PaymentProvider {
  readonly name = DEVELOPMENT_PAYMENT_PROVIDER;

  private readonly secret =
    process.env.DEV_PAYMENT_WEBHOOK_SECRET ?? 'dev-webhook-secret';

  createPayment(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    return Promise.resolve({
      providerPaymentId: `dev_${input.paymentId}_${randomUUID().slice(0, 8)}`,
      status: 'PENDING',
    });
  }

  getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return Promise.resolve({ providerPaymentId, status: 'PENDING' });
  }

  cancelPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return Promise.resolve({ providerPaymentId, status: 'CANCELLED' });
  }

  refundPayment(
    providerPaymentId: string,
    amount: string,
  ): Promise<ProviderPaymentStatus> {
    void amount;
    return Promise.resolve({ providerPaymentId, status: 'REFUNDED' });
  }

  verifyWebhook(
    input: WebhookVerificationInput,
  ): Promise<VerifiedWebhookEvent> {
    const header = input.headers['x-dev-webhook-secret'];
    const secret = Array.isArray(header) ? header[0] : header;
    if (secret !== this.secret) {
      return Promise.reject(
        new UnauthorizedException('Invalid webhook signature'),
      );
    }

    const body = input.rawBody as {
      eventKey?: string;
      providerPaymentId?: string;
      status?: VerifiedWebhookEvent['status'];
    };

    if (!body?.eventKey || !body.providerPaymentId || !body.status) {
      return Promise.reject(new BadRequestException('Invalid webhook payload'));
    }

    return Promise.resolve({
      eventKey: body.eventKey,
      providerPaymentId: body.providerPaymentId,
      status: body.status,
    });
  }
}
