export const DEVELOPMENT_PAYMENT_PROVIDER = 'development';

export type CreatePaymentIntentInput = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  method: string;
};

export type CreatePaymentIntentResult = {
  providerPaymentId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED';
  failureCode?: string;
  failureMessage?: string;
};

export type ProviderPaymentStatus = {
  providerPaymentId: string;
  status:
    'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
};

export type WebhookVerificationInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: unknown;
};

export type VerifiedWebhookEvent = {
  eventKey: string;
  providerPaymentId: string;
  status: 'PAID' | 'FAILED' | 'AUTHORIZED' | 'CANCELLED' | 'REFUNDED';
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  cancelPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  refundPayment(
    providerPaymentId: string,
    amount: string,
  ): Promise<ProviderPaymentStatus>;
  verifyWebhook(input: WebhookVerificationInput): Promise<VerifiedWebhookEvent>;
}
