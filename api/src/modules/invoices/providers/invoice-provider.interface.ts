import type {
  ProviderAddressInput,
  ProviderCustomerInput,
  ProviderDocumentInput,
  ProviderDocumentResult,
  ProviderEntitySyncResult,
  ProviderFormalizeInput,
  ProviderFormalizeResult,
  ProviderInvoiceCreateResult,
  ProviderInvoiceInput,
  ProviderInvoiceRemoteState,
  ProviderInvoiceRemoteStateInput,
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
  /**
   * Distinguishes config vs upstream auth vs other failures.
   * OK | NOT_CONFIGURED | UNAUTHORIZED | FORBIDDEN | UPSTREAM | UNKNOWN
   */
  code: string;
};

/**
 * Pluggable e-document provider (KolayBi first; Logo/Paraşüt later).
 * Phase 5: createInvoice = draft.
 * Phase 6: formalizeInvoice = GİB e-document.
 * Phase 8: getInvoiceDocument / getInvoiceRemoteState = retrieve + sync.
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
   * Does NOT formalize e-Fatura/e-Arşiv.
   */
  createInvoice(
    input: ProviderInvoiceInput,
  ): Promise<ProviderInvoiceCreateResult>;
  /**
   * Formalize draft invoice as e-document (e-Fatura / e-Arşiv).
   * KolayBi chooses scenario from associate; request only sends document_id.
   */
  formalizeInvoice(
    input: ProviderFormalizeInput,
  ): Promise<ProviderFormalizeResult>;
  /**
   * Retrieve e-document bytes (PDF/XML per provider docs).
   * KolayBi: GET /invoices/e-document/view?uuid=&output_type=
   */
  getInvoiceDocument(
    input: ProviderDocumentInput,
  ): Promise<ProviderDocumentResult>;
  /**
   * Lookup remote uuid / serial / e-document status without mutating Sale.
   * KolayBi: GET detail + GET list (documented fields only).
   */
  getInvoiceRemoteState(
    input: ProviderInvoiceRemoteStateInput,
  ): Promise<ProviderInvoiceRemoteState>;
}
