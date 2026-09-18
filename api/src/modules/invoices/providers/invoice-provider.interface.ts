import type {
  ProviderAddressInput,
  ProviderCustomerInput,
  ProviderEntitySyncResult,
  ProviderInvoiceCreateResult,
  ProviderInvoiceInput,
  ProviderProductInput,
} from './provider-customer.types';

export const KOLAYBI_INVOICE_PROVIDER = 'KOLAYBI';

export const INVOICE_PROVIDERS = Symbol('INVOICE_PROVIDERS');

export type InvoiceProviderHealth = {
  provider: string;
  enabled: boolean;
  ok: boolean;
  sandbox: boolean;
  message: string;
};

/**
 * Pluggable e-document provider (KolayBi first; Logo/Paraşüt later).
 * Phase 5: createInvoice = provider draft invoice (not GİB formalize).
 */
export interface InvoiceProvider {
  readonly code: string;
  readonly enabled: boolean;
  authenticate(): Promise<void>;
  healthCheck(): Promise<InvoiceProviderHealth>;
  ensureCustomer(
    input: ProviderCustomerInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult>;
  ensureAddress(
    input: ProviderAddressInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult>;
  ensureProduct(
    input: ProviderProductInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult>;
  /**
   * Create provider invoice (draft / ready_to_send).
   * Does NOT formalize e-Fatura/e-Arşiv (Phase 6).
   * On conflict/timeout, adapters may resolve via description/serial lookup.
   */
  createInvoice(
    input: ProviderInvoiceInput,
  ): Promise<ProviderInvoiceCreateResult>;
}
