import { Injectable, Logger } from '@nestjs/common';
import { KolayBiClient } from '../clients/kolaybi.client';
import { KolayBiApiError } from '../clients/kolaybi.errors';
import {
  InvoiceProvider,
  InvoiceProviderHealth,
  KOLAYBI_INVOICE_PROVIDER,
} from './invoice-provider.interface';
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

type KolayBiDataEnvelope<T> = { data?: T };

type KolayBiAssociate = {
  id?: number | string;
  code?: string;
  identity_no?: string;
  address?: Array<{ id?: number | string }>;
};

type KolayBiAddress = {
  id?: number | string;
};

type KolayBiProduct = {
  id?: number | string;
  code?: string;
  barcode?: string;
};

type KolayBiInvoiceCreateData = {
  document_id?: number | string;
  grand_total?: number | string;
  grand_currency?: string;
};

type KolayBiInvoiceListRow = {
  commercial_doc_id?: number | string;
  e_document_status?: string;
  commercial_doc_status?: {
    value?: string;
    key?: string;
    description?: string;
  };
  header?: {
    serial_no?: string;
    description?: string;
  };
  total?: {
    grand_total?: number | string;
  };
};

type KolayBiEDocumentData = {
  document_id?: number | string;
  uuid?: string;
  no?: string;
  status?: string;
  scenario?: string;
  type?: string;
};

type KolayBiInvoiceDetailData = {
  uuid?: string;
};

type KolayBiEDocumentViewData = {
  src?: string;
  output_type?: string;
};

/** Document retrieve can return large base64 payloads.
 * Production note (Phase 9): 30s is adequate for typical e-docs;
 * bump only after measuring sandbox large-PDF latency — do not invent.
 */
const DOCUMENT_VIEW_TIMEOUT_MS = 30_000;

/**
 * KolayBi adapter.
 * Associate/Product/Invoice HTTP details stay here — domain uses Customer/Address/Product terminology.
 *
 * Documented APIs used:
 * - POST /associates (form) — create
 * - GET /associates/{id} — detail
 * - GET /associates?code= — list filter (orphan recovery)
 * - GET /associates?identity_no= — list filter (orphan recovery)
 * - POST /address/create (form) — address create
 * - POST /products (form) — product create
 * - GET /products/{id} — product detail
 * - GET /products?code=|&barcode= — list filter (orphan recovery)
 * - POST /invoices (form) — draft invoice create (Phase 5; not GİB formalize)
 * - GET /invoices?description=|&associate_id= — list (orphan recovery)
 * - POST /invoices/e-document/create (form) — formalize (Phase 6)
 * - GET /invoices/{document_id} — detail (uuid after formalize; timeout recovery)
 * - GET /invoices/e-document/view?uuid=&output_type= — PDF/XML (Phase 8)
 *
 * Product UPDATE (PUT) exists in KolayBi docs but Phase 4 ensure does not auto-push local edits.
 * Associate/address have no public UPDATE as of Phase 3.
 * E-document request does NOT accept scenario — KolayBi derives e-Fatura vs e-Arşiv from associate.
 * No public webhook endpoints in KolayBi developer sitemap (Phase 8).
 */
@Injectable()
export class KolayBiInvoiceProvider implements InvoiceProvider {
  private readonly logger = new Logger(KolayBiInvoiceProvider.name);
  readonly code = KOLAYBI_INVOICE_PROVIDER;

  constructor(private readonly client: KolayBiClient) {}

  get enabled(): boolean {
    return this.client.isConfigured();
  }

  authenticate(): Promise<void> {
    return this.client.authenticate();
  }

  async healthCheck(): Promise<InvoiceProviderHealth> {
    const sandbox = this.client.isSandbox();

    if (!this.enabled) {
      return {
        provider: this.code,
        enabled: false,
        ok: false,
        sandbox,
        code: 'NOT_CONFIGURED',
        message:
          'KolayBi not configured (set KOLAYBI_API_BASE_URL, KOLAYBI_API_KEY, KOLAYBI_CHANNEL)',
      };
    }

    try {
      await this.client.authenticate();
      await this.client.request('/companies', { method: 'GET' });
      return {
        provider: this.code,
        enabled: true,
        ok: true,
        sandbox,
        code: 'OK',
        message: 'KolayBi authentication and companies endpoint OK',
      };
    } catch (err) {
      const errCode = err instanceof KolayBiApiError ? err.code : 'UNKNOWN';
      const message =
        err instanceof KolayBiApiError
          ? err.message
          : 'KolayBi health check failed';
      this.logger.warn(
        JSON.stringify({
          provider: this.code,
          event: 'health_failed',
          code: errCode,
        }),
      );

      let code = 'UPSTREAM';
      if (errCode === 'KOLAYBI_UNAUTHORIZED') code = 'UNAUTHORIZED';
      else if (errCode === 'KOLAYBI_FORBIDDEN') code = 'FORBIDDEN';
      else if (errCode === 'KOLAYBI_NOT_CONFIGURED') code = 'NOT_CONFIGURED';

      return {
        provider: this.code,
        enabled: true,
        ok: false,
        sandbox,
        code,
        message,
      };
    }
  }

  async ensureCustomer(
    input: ProviderCustomerInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult> {
    const started = Date.now();
    const stableCode = associateCodeForUser(input.localUserId);

    if (existingExternalId) {
      try {
        await this.client.request(`/associates/${existingExternalId}`, {
          method: 'GET',
        });
        this.logOp('ensure_customer_verify', input.localUserId, null, {
          externalId: existingExternalId,
          durationMs: Date.now() - started,
        });
        return {
          provider: this.code,
          localEntityId: input.localUserId,
          externalId: String(existingExternalId),
          created: false,
          verifiedExisting: true,
        };
      } catch (err) {
        if (!(err instanceof KolayBiApiError) || err.statusCode !== 404) {
          throw err;
        }
        this.logger.warn(
          JSON.stringify({
            provider: this.code,
            event: 'associate_missing_recreate',
            userId: input.localUserId,
          }),
        );
      }
    }

    const created = await this.createOrResolveAssociate(input, stableCode);
    this.logOp('ensure_customer_create', input.localUserId, null, {
      externalId: created.externalId,
      created: created.created,
      durationMs: Date.now() - started,
    });
    return created;
  }

  async ensureAddress(
    input: ProviderAddressInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult> {
    const started = Date.now();

    if (existingExternalId) {
      // No public address GET/UPDATE in docs — treat linked id as verified.
      this.logOp(
        'ensure_address_verify',
        input.localUserId,
        input.localAddressId,
        {
          externalId: existingExternalId,
          durationMs: Date.now() - started,
        },
      );
      return {
        provider: this.code,
        localEntityId: input.localAddressId,
        externalId: String(existingExternalId),
        created: false,
        verifiedExisting: true,
      };
    }

    const form: Record<string, string> = {
      associate_id: String(input.providerCustomerId),
      address: buildAddressLine(input),
      city: input.city.trim(),
      district: input.district.trim(),
      country: countryDisplayName(input.countryCode),
      address_type: 'invoice',
      is_abroad: input.countryCode.toUpperCase() === 'TR' ? 'false' : 'true',
    };
    if (input.postalCode?.trim()) {
      form.postal_code = input.postalCode.trim();
    }

    const response = await this.client.request<
      KolayBiDataEnvelope<KolayBiAddress>
    >('/address/create', { method: 'POST', contentType: 'form', body: form });

    const id = response?.data?.id;
    if (id === undefined || id === null) {
      throw new KolayBiApiError(
        'KolayBi address create response missing id',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      );
    }

    const externalId = String(id);
    this.logOp(
      'ensure_address_create',
      input.localUserId,
      input.localAddressId,
      {
        externalId,
        durationMs: Date.now() - started,
      },
    );

    return {
      provider: this.code,
      localEntityId: input.localAddressId,
      externalId,
      created: true,
      verifiedExisting: false,
    };
  }

  async ensureProduct(
    input: ProviderProductInput,
    existingExternalId: string | null,
  ): Promise<ProviderEntitySyncResult> {
    const started = Date.now();
    const code = input.sku.trim();

    if (existingExternalId) {
      try {
        await this.client.request(`/products/${existingExternalId}`, {
          method: 'GET',
        });
        this.logOp('ensure_product_verify', null, null, {
          productId: input.localProductId,
          sku: code,
          externalId: existingExternalId,
          durationMs: Date.now() - started,
        });
        return {
          provider: this.code,
          localEntityId: input.localProductId,
          externalId: String(existingExternalId),
          created: false,
          verifiedExisting: true,
        };
      } catch (err) {
        if (!(err instanceof KolayBiApiError) || err.statusCode !== 404) {
          throw err;
        }
        this.logger.warn(
          JSON.stringify({
            provider: this.code,
            event: 'product_missing_recreate',
            productId: input.localProductId,
            sku: code,
          }),
        );
      }
    }

    const lookedUp = await this.findProductId(code, input.barcode);
    if (lookedUp) {
      this.logOp('ensure_product_link_existing', null, null, {
        productId: input.localProductId,
        sku: code,
        externalId: lookedUp,
        durationMs: Date.now() - started,
      });
      return {
        provider: this.code,
        localEntityId: input.localProductId,
        externalId: lookedUp,
        created: false,
        verifiedExisting: true,
      };
    }

    const created = await this.createOrResolveProduct(input, code);
    this.logOp('ensure_product_create', null, null, {
      productId: input.localProductId,
      sku: code,
      externalId: created.externalId,
      created: created.created,
      durationMs: Date.now() - started,
    });
    return created;
  }

  /**
   * POST /invoices — creates provider draft invoice (ready_to_send).
   * Does not call e-document formalize.
   */
  async createInvoice(
    input: ProviderInvoiceInput,
  ): Promise<ProviderInvoiceCreateResult> {
    const started = Date.now();

    const existing = await this.findInvoiceByDescription(
      input.description,
      input.providerCustomerId,
    );
    if (existing) {
      this.logOp('create_invoice_resolve_existing', null, null, {
        invoiceId: input.localInvoiceId,
        saleId: input.localSaleId,
        externalId: existing.externalDocumentId,
        durationMs: Date.now() - started,
      });
      return { ...existing, created: false, resolvedExisting: true };
    }

    const form = this.toInvoiceForm(input);

    try {
      const response = await this.client.request<
        KolayBiDataEnvelope<KolayBiInvoiceCreateData>
      >('/invoices', {
        method: 'POST',
        contentType: 'form',
        body: form,
      });

      const documentId = response?.data?.document_id;
      if (documentId === undefined || documentId === null) {
        throw new KolayBiApiError(
          'KolayBi invoice create response missing document_id',
          502,
          'KOLAYBI_INVALID_RESPONSE',
          true,
        );
      }

      const grandTotal =
        response?.data?.grand_total !== undefined &&
        response?.data?.grand_total !== null
          ? String(response.data.grand_total)
          : null;

      this.logOp('create_invoice', null, null, {
        invoiceId: input.localInvoiceId,
        saleId: input.localSaleId,
        externalId: String(documentId),
        durationMs: Date.now() - started,
      });

      return {
        provider: this.code,
        externalDocumentId: String(documentId),
        invoiceNumber: input.saleNumber,
        uuid: null,
        grandTotal,
        created: true,
        resolvedExisting: false,
      };
    } catch (err) {
      if (
        err instanceof KolayBiApiError &&
        (err.statusCode === 409 || err.statusCode === 400)
      ) {
        const resolved = await this.findInvoiceByDescription(
          input.description,
          input.providerCustomerId,
        );
        if (resolved) {
          return { ...resolved, created: false, resolvedExisting: true };
        }
      }
      throw err;
    }
  }

  private toInvoiceForm(input: ProviderInvoiceInput): Record<string, string> {
    const form: Record<string, string> = {
      contact_id: String(input.providerCustomerId),
      address_id: String(input.providerAddressId),
      order_date: input.orderDate,
      currency: input.currency.trim().toLowerCase(),
      type: 'sale_invoice',
      serial_no: input.saleNumber,
      description: input.description,
      tracking_currency: input.currency.trim().toLowerCase(),
    };

    if (input.receiverEmail?.trim()) {
      form.receiver_email = input.receiverEmail.trim();
    }

    form['order_reference[serial_no]'] = input.saleNumber;
    form['order_reference[issue_date]'] = input.orderDate;

    input.lines.forEach((line, index) => {
      form[`items[${index}][product_id]`] = String(line.providerProductId);
      form[`items[${index}][quantity]`] = `${line.quantity}.00`;
      form[`items[${index}][unit_price]`] = line.unitPriceExclusive;
      form[`items[${index}][vat_rate]`] = line.vatRate;
      if (line.description.trim()) {
        form[`items[${index}][description]`] = line.description.trim();
      }
      if (line.discountAmount && line.discountAmount !== '0.00') {
        form[`items[${index}][discount_amount]`] = line.discountAmount;
      }
    });

    return form;
  }

  private async findInvoiceByDescription(
    description: string,
    providerCustomerId: string,
  ): Promise<ProviderInvoiceCreateResult | null> {
    const qs = new URLSearchParams({
      type: 'sale_invoice',
      description,
      associate_id: String(providerCustomerId),
    }).toString();

    const response = await this.client.request<
      KolayBiDataEnvelope<KolayBiInvoiceListRow[] | KolayBiInvoiceListRow>
    >(`/invoices?${qs}`, { method: 'GET' });

    const rows = Array.isArray(response?.data)
      ? response.data
      : response?.data
        ? [response.data]
        : [];

    const match =
      rows.find((row) => row.header?.description === description) ?? rows[0];
    const id = match?.commercial_doc_id;
    if (id === undefined || id === null) return null;

    const grand =
      match?.total?.grand_total !== undefined &&
      match?.total?.grand_total !== null
        ? String(match.total.grand_total)
        : null;

    return {
      provider: this.code,
      externalDocumentId: String(id),
      invoiceNumber: match?.header?.serial_no ?? null,
      uuid: null,
      grandTotal: grand,
      created: false,
      resolvedExisting: true,
    };
  }

  /**
   * POST /invoices/e-document/create — formalize draft as e-document.
   * Docs: only document_id required; optional prefix. No scenario field.
   * Timeout recovery: GET /invoices/{document_id} may return uuid if already formalized.
   */
  async formalizeInvoice(
    input: ProviderFormalizeInput,
  ): Promise<ProviderFormalizeResult> {
    const started = Date.now();
    const documentId = String(input.externalDocumentId).trim();

    const already = await this.findFormalizedUuid(documentId);
    if (already) {
      this.logOp('formalize_resolve_existing', null, null, {
        invoiceId: input.localInvoiceId,
        externalId: documentId,
        durationMs: Date.now() - started,
      });
      return {
        provider: this.code,
        externalDocumentId: documentId,
        uuid: already,
        invoiceNumber: null,
        providerStatus: null,
        providerScenario: null,
        resolvedExisting: true,
      };
    }

    const form: Record<string, string> = {
      document_id: documentId,
    };
    if (input.prefix?.trim()) {
      form.prefix = input.prefix.trim();
    }

    try {
      const response = await this.client.request<
        KolayBiDataEnvelope<KolayBiEDocumentData> & { success?: boolean }
      >('/invoices/e-document/create', {
        method: 'POST',
        contentType: 'form',
        body: form,
      });

      const data = response?.data;
      const uuid = data?.uuid?.trim();
      if (!uuid) {
        throw new KolayBiApiError(
          'KolayBi e-document create response missing uuid',
          502,
          'KOLAYBI_INVALID_RESPONSE',
          true,
        );
      }

      this.logOp('formalize_invoice', null, null, {
        invoiceId: input.localInvoiceId,
        externalId: documentId,
        durationMs: Date.now() - started,
      });

      return {
        provider: this.code,
        externalDocumentId: String(data?.document_id ?? documentId),
        uuid,
        invoiceNumber: data?.no?.trim() || null,
        providerStatus: data?.status?.trim() || null,
        providerScenario: data?.scenario?.trim() || null,
        resolvedExisting: false,
      };
    } catch (err) {
      if (
        err instanceof KolayBiApiError &&
        (err.statusCode === 409 ||
          err.statusCode === 400 ||
          err.retryable ||
          err.code === 'KOLAYBI_TIMEOUT')
      ) {
        const resolvedUuid = await this.findFormalizedUuid(documentId);
        if (resolvedUuid) {
          return {
            provider: this.code,
            externalDocumentId: documentId,
            uuid: resolvedUuid,
            invoiceNumber: null,
            providerStatus: null,
            providerScenario: null,
            resolvedExisting: true,
          };
        }
      }
      throw err;
    }
  }

  /** GET /invoices/{id} — docs return uuid after formalize. */
  private async findFormalizedUuid(documentId: string): Promise<string | null> {
    try {
      const response = await this.client.request<
        KolayBiDataEnvelope<KolayBiInvoiceDetailData>
      >(`/invoices/${documentId}`, { method: 'GET' });
      const uuid = response?.data?.uuid?.trim();
      return uuid || null;
    } catch (err) {
      if (err instanceof KolayBiApiError && err.statusCode === 404) {
        return null;
      }
      if (
        err instanceof KolayBiApiError &&
        (err.statusCode === 401 ||
          err.statusCode === 403 ||
          err.statusCode === 429)
      ) {
        throw err;
      }
      return null;
    }
  }

  /**
   * GET /invoices/e-document/view — documented PDF/XML retrieve.
   * Response is JSON `{ data: { src: base64, output_type } }` — decode server-side.
   * Docs: https://developer.kolaybi.com/docs/invoices/e-document-view
   */
  async getInvoiceDocument(
    input: ProviderDocumentInput,
  ): Promise<ProviderDocumentResult> {
    const uuid = input.uuid.trim();
    if (!uuid) {
      throw new KolayBiApiError(
        'uuid required for e-document view',
        400,
        'KOLAYBI_VALIDATION_ERROR',
        false,
      );
    }

    const qs = new URLSearchParams({
      uuid,
      output_type: input.outputType,
    });
    if (input.direction) {
      qs.set('direction', input.direction);
    }

    const started = Date.now();
    const response = await this.client.request<
      KolayBiDataEnvelope<KolayBiEDocumentViewData>
    >(`/invoices/e-document/view?${qs.toString()}`, {
      method: 'GET',
      timeoutMs: DOCUMENT_VIEW_TIMEOUT_MS,
    });

    const src = response?.data?.src?.trim();
    const outputTypeRaw = (response?.data?.output_type ?? input.outputType)
      .toString()
      .trim()
      .toLowerCase();

    if (!src) {
      throw new KolayBiApiError(
        'KolayBi e-document view response missing src',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      );
    }

    let body: Buffer;
    try {
      body = Buffer.from(src, 'base64');
    } catch {
      throw new KolayBiApiError(
        'KolayBi e-document view src is not valid base64',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      );
    }

    if (body.length === 0) {
      throw new KolayBiApiError(
        'KolayBi e-document view returned empty document',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      );
    }

    const outputType =
      outputTypeRaw === 'xml' ? ('xml' as const) : ('pdf' as const);

    this.logOp('get_invoice_document', null, null, {
      invoiceId: null,
      externalId: null,
      durationMs: Date.now() - started,
    });

    return {
      provider: this.code,
      outputType,
      contentType: outputType === 'xml' ? 'application/xml' : 'application/pdf',
      body,
    };
  }

  /**
   * Sync lookup: GET /invoices/{document_id} (uuid) + GET /invoices?description=
   * (serial_no, e_document_status). No dedicated status endpoint in public docs.
   */
  async getInvoiceRemoteState(
    input: ProviderInvoiceRemoteStateInput,
  ): Promise<ProviderInvoiceRemoteState> {
    const documentId = String(input.externalDocumentId).trim();
    const description = input.description.trim();

    const uuid = await this.findFormalizedUuid(documentId);

    let invoiceNumber: string | null = null;
    let providerEDocumentStatus: string | null = null;
    let providerCommercialStatus: string | null = null;

    if (description) {
      const qs = new URLSearchParams({
        type: 'sale_invoice',
        description,
      }).toString();

      try {
        const response = await this.client.request<
          KolayBiDataEnvelope<KolayBiInvoiceListRow[] | KolayBiInvoiceListRow>
        >(`/invoices?${qs}`, { method: 'GET' });

        const rows = Array.isArray(response?.data)
          ? response.data
          : response?.data
            ? [response.data]
            : [];

        const match =
          rows.find((row) => String(row.commercial_doc_id) === documentId) ??
          rows.find((row) => row.header?.description === description) ??
          null;

        if (match) {
          invoiceNumber = match.header?.serial_no?.trim() || null;
          providerEDocumentStatus = match.e_document_status?.trim() || null;
          providerCommercialStatus =
            match.commercial_doc_status?.value?.trim() || null;
        }
      } catch (err) {
        // Detail uuid is still useful; list failure should surface for auth/rate limits
        if (
          err instanceof KolayBiApiError &&
          (err.statusCode === 401 ||
            err.statusCode === 403 ||
            err.statusCode === 429 ||
            err.code === 'KOLAYBI_TIMEOUT')
        ) {
          throw err;
        }
        this.logger.warn(
          JSON.stringify({
            provider: this.code,
            event: 'remote_state_list_failed',
            documentId,
          }),
        );
      }
    }

    return {
      provider: this.code,
      externalDocumentId: documentId,
      uuid,
      invoiceNumber,
      providerEDocumentStatus,
      providerCommercialStatus,
    };
  }

  private async createOrResolveProduct(
    input: ProviderProductInput,
    code: string,
  ): Promise<ProviderEntitySyncResult> {
    const form = this.toProductForm(input, code);

    try {
      const response = await this.client.request<
        KolayBiDataEnvelope<KolayBiProduct>
      >('/products', {
        method: 'POST',
        contentType: 'form',
        body: form,
      });
      const id = response?.data?.id;
      if (id === undefined || id === null) {
        throw new KolayBiApiError(
          'KolayBi product create response missing id',
          502,
          'KOLAYBI_INVALID_RESPONSE',
          true,
        );
      }
      return {
        provider: this.code,
        localEntityId: input.localProductId,
        externalId: String(id),
        created: true,
        verifiedExisting: false,
      };
    } catch (err) {
      if (
        err instanceof KolayBiApiError &&
        (err.statusCode === 409 || err.statusCode === 400)
      ) {
        const resolved = await this.findProductId(code, input.barcode);
        if (resolved) {
          return {
            provider: this.code,
            localEntityId: input.localProductId,
            externalId: resolved,
            created: false,
            verifiedExisting: true,
          };
        }
      }
      throw err;
    }
  }

  private async findProductId(
    code: string,
    barcode: string | null,
  ): Promise<string | null> {
    const byCode = await this.listProducts({ code });
    const fromCode = firstProductId(byCode);
    if (fromCode) return fromCode;

    const trimmedBarcode = barcode?.trim();
    if (trimmedBarcode) {
      const byBarcode = await this.listProducts({ barcode: trimmedBarcode });
      return firstProductId(byBarcode);
    }
    return null;
  }

  private async listProducts(
    filters: Record<string, string>,
  ): Promise<KolayBiProduct[]> {
    const qs = new URLSearchParams(filters).toString();
    const response = await this.client.request<
      KolayBiDataEnvelope<KolayBiProduct[] | KolayBiProduct>
    >(`/products?${qs}`, { method: 'GET' });
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return [data];
    return [];
  }

  private toProductForm(
    input: ProviderProductInput,
    code: string,
  ): Record<string, string> {
    const form: Record<string, string> = {
      name: input.name.trim(),
      code,
      product_type: 'good',
      vat_rate: input.vatRate.trim(),
    };

    if (input.barcode?.trim()) {
      form.barcode = input.barcode.trim();
    }
    if (input.description?.trim()) {
      form.description = input.description.trim();
    }
    // price intentionally omitted — invoice uses SaleItem.unitPrice
    // unit not in KolayBi create params — do not invent ADET field

    return form;
  }

  private async createOrResolveAssociate(
    input: ProviderCustomerInput,
    stableCode: string,
  ): Promise<ProviderEntitySyncResult> {
    const form = this.toAssociateForm(input, stableCode);

    try {
      const response = await this.client.request<
        KolayBiDataEnvelope<KolayBiAssociate>
      >('/associates', {
        method: 'POST',
        contentType: 'form',
        body: form,
      });
      const id = response?.data?.id;
      if (id === undefined || id === null) {
        throw new KolayBiApiError(
          'KolayBi associate create response missing id',
          502,
          'KOLAYBI_INVALID_RESPONSE',
          true,
        );
      }
      return {
        provider: this.code,
        localEntityId: input.localUserId,
        externalId: String(id),
        created: true,
        verifiedExisting: false,
      };
    } catch (err) {
      if (
        err instanceof KolayBiApiError &&
        (err.statusCode === 409 || err.statusCode === 400)
      ) {
        const resolved = await this.findAssociateId(stableCode, input);
        if (resolved) {
          return {
            provider: this.code,
            localEntityId: input.localUserId,
            externalId: resolved,
            created: false,
            verifiedExisting: true,
          };
        }
      }
      throw err;
    }
  }

  private async findAssociateId(
    stableCode: string,
    input: ProviderCustomerInput,
  ): Promise<string | null> {
    const byCode = await this.listAssociates({ code: stableCode });
    const fromCode = firstAssociateId(byCode);
    if (fromCode) return fromCode;

    const byIdentity = await this.listAssociates({
      identity_no: input.taxOrIdentityNumber,
    });
    return firstAssociateId(byIdentity);
  }

  private async listAssociates(
    filters: Record<string, string>,
  ): Promise<KolayBiAssociate[]> {
    const qs = new URLSearchParams(filters).toString();
    const response = await this.client.request<
      KolayBiDataEnvelope<KolayBiAssociate[] | KolayBiAssociate>
    >(`/associates?${qs}`, { method: 'GET' });
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return [data];
    return [];
  }

  private toAssociateForm(
    input: ProviderCustomerInput,
    stableCode: string,
  ): Record<string, string> {
    const isCorporate = input.type === 'CORPORATE';
    const name = isCorporate
      ? (input.companyName ?? '').trim()
      : input.firstName.trim();
    const surname = isCorporate
      ? corporateSurname(input)
      : input.lastName.trim();

    const form: Record<string, string> = {
      name,
      surname,
      identity_no: input.taxOrIdentityNumber.trim(),
      is_corporate: isCorporate ? 'true' : 'false',
      associate_type: 'customer',
      code: stableCode,
    };

    if (input.email?.trim()) form.email = input.email.trim();
    if (input.phone?.trim()) form.phone = input.phone.trim();
    if (isCorporate && input.taxOffice?.trim()) {
      form.tax_office = input.taxOffice.trim();
    }

    return form;
  }

  private logOp(
    operation: string,
    userId: string | null,
    addressId: string | null,
    extra: Record<string, unknown>,
  ): void {
    this.logger.log(
      JSON.stringify({
        provider: this.code,
        operation,
        userId,
        addressId,
        ...extra,
      }),
    );
  }
}

export function associateCodeForUser(userId: string): string {
  return `fs-user-${userId}`;
}

function corporateSurname(input: ProviderCustomerInput): string {
  const last = input.lastName.trim();
  if (last.length >= 2) return last;
  const first = input.firstName.trim();
  if (first.length >= 2) return first;
  return 'Yetkili';
}

function buildAddressLine(input: ProviderAddressInput): string {
  const parts = [input.neighborhood?.trim(), input.addressLine.trim()].filter(
    Boolean,
  );
  return parts.join(' ').trim();
}

function countryDisplayName(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === 'TR') return 'Türkiye';
  return code.trim() || 'Türkiye';
}

function firstAssociateId(rows: KolayBiAssociate[]): string | null {
  const id = rows[0]?.id;
  if (id === undefined || id === null) return null;
  return String(id);
}

function firstProductId(rows: KolayBiProduct[]): string | null {
  const id = rows[0]?.id;
  if (id === undefined || id === null) return null;
  return String(id);
}
