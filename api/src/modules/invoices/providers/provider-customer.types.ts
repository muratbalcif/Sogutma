/**
 * Provider-neutral customer/address payloads for InvoiceProvider adapters.
 * KolayBi-specific field names stay inside KolayBiInvoiceProvider.
 */

export type ProviderCustomerType = 'INDIVIDUAL' | 'CORPORATE';

export type ProviderCustomerInput = {
  localUserId: string;
  type: ProviderCustomerType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  /** TCKN (individual) or VKN (corporate) — never invent. */
  taxOrIdentityNumber: string;
  companyName?: string | null;
  taxOffice?: string | null;
};

export type ProviderAddressInput = {
  localAddressId: string;
  localUserId: string;
  /** Provider associate/customer id — required before address sync. */
  providerCustomerId: string;
  addressLine: string;
  city: string;
  district: string;
  countryCode: string;
  postalCode: string | null;
  neighborhood: string | null;
};

/**
 * Provider-neutral product payload for InvoiceProvider adapters.
 * Price is intentionally omitted — invoice lines use SaleItem.unitPrice later.
 */
export type ProviderProductInput = {
  localProductId: string;
  /** Stable product code (FurkanSoğutma SKU → provider code). */
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  /**
   * VAT percent as decimal string (e.g. "20.00") — never invent a rate.
   * Adapter maps to provider field (KolayBi: vat_rate).
   */
  vatRate: string;
};

export type ProviderEntitySyncResult = {
  provider: string;
  localEntityId: string;
  externalId: string;
  created: boolean;
  /** true when an existing remote record was verified / resolved (not newly created). */
  verifiedExisting: boolean;
};

/** One invoice line — prices from SaleItem snapshot (not live ProductPrice). */
export type ProviderInvoiceLineInput = {
  /** Provider product id (KolayBi product id). */
  providerProductId: string;
  description: string;
  quantity: number;
  /**
   * Unit price as decimal string, VAT-exclusive (SaleItem lineSubtotal / qty).
   * Sale unitPrice is tax-inclusive; never send inclusive price as unit_price.
   */
  unitPriceExclusive: string;
  /** VAT percent string, e.g. "20.00". */
  vatRate: string;
  /** Line discount in TRY (optional); prefer baking into unit when already applied. */
  discountAmount?: string;
};

export type ProviderInvoiceInput = {
  localInvoiceId: string;
  localSaleId: string;
  saleNumber: string;
  /** Provider associate/customer id. */
  providerCustomerId: string;
  /** Provider billing address id. */
  providerAddressId: string;
  /** YYYY-MM-DD in business timezone. */
  orderDate: string;
  /** ISO currency; adapter lowercases for KolayBi (try). */
  currency: string;
  /** Stable description used for orphan lookup: SALE:{saleId}. */
  description: string;
  receiverEmail?: string | null;
  lines: ProviderInvoiceLineInput[];
  /** Expected grand total (tax-inclusive) for post-create comparison. */
  expectedGrandTotal: string;
};

export type ProviderInvoiceCreateResult = {
  provider: string;
  externalDocumentId: string;
  /** Provider serial / invoice number when known. */
  invoiceNumber: string | null;
  /** GİB ETTN — usually null until Phase 6 formalize. */
  uuid: string | null;
  /** Provider-reported grand total (string decimal) when available. */
  grandTotal: string | null;
  created: boolean;
  /** true when an existing remote invoice was resolved (timeout/orphan recovery). */
  resolvedExisting: boolean;
};

/** Formalize (e-document create) — provider draft → GİB e-document. */
export type ProviderFormalizeInput = {
  localInvoiceId: string;
  /** KolayBi document_id from draft create. */
  externalDocumentId: string;
  /**
   * Optional series prefix if company uses custom prefixes.
   * Omitted → KolayBi company default (per docs).
   */
  prefix?: string | null;
};

export type ProviderFormalizeResult = {
  provider: string;
  externalDocumentId: string;
  /** GİB ETTN from provider response (or detail lookup). */
  uuid: string;
  /** Formalized document number (`no`) when returned. */
  invoiceNumber: string | null;
  /** Provider e-document status string when returned (e.g. sent_to_receiver). */
  providerStatus: string | null;
  /** Provider scenario string when returned (e.g. EARSIVFATURA) — informational. */
  providerScenario: string | null;
  /** true when already formalized remotely and linked without a new create. */
  resolvedExisting: boolean;
};

/** Documented KolayBi output_type values for e-document/view. */
export type ProviderDocumentOutputType = 'pdf' | 'xml';

export type ProviderDocumentInput = {
  /** GİB ETTN / provider uuid — required by KolayBi e-document/view. */
  uuid: string;
  outputType: ProviderDocumentOutputType;
  /** Docs default: outbound. */
  direction?: 'outbound' | 'inbound';
};

/**
 * Binary document bytes decoded from provider response.
 * KolayBi returns base64 in JSON (`data.src`); we decode server-side.
 * Future R2 persist can accept this buffer without changing the admin API.
 */
export type ProviderDocumentResult = {
  provider: string;
  outputType: ProviderDocumentOutputType;
  contentType: string;
  body: Buffer;
};

/**
 * Remote invoice snapshot for local sync.
 * Built from documented detail + list endpoints (no invented status API).
 */
export type ProviderInvoiceRemoteStateInput = {
  externalDocumentId: string;
  /** Stable description SALE:{saleId} for list filter / orphan match. */
  description: string;
};

export type ProviderInvoiceRemoteState = {
  provider: string;
  externalDocumentId: string;
  /** From GET /invoices/{document_id} — may be null for drafts. */
  uuid: string | null;
  /** From list header.serial_no when row matched. */
  invoiceNumber: string | null;
  /**
   * From list `e_document_status` when available.
   * Ephemeral — not a local InvoiceStatus enum value.
   */
  providerEDocumentStatus: string | null;
  /**
   * From list `commercial_doc_status.value` when available.
   * Ephemeral — not persisted without a dedicated schema field.
   */
  providerCommercialStatus: string | null;
};
