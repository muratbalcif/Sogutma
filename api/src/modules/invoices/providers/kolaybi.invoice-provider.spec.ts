import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KolayBiClient } from '../clients/kolaybi.client';
import { KolayBiApiError } from '../clients/kolaybi.errors';
import {
  associateCodeForUser,
  KolayBiInvoiceProvider,
} from './kolaybi.invoice-provider';

function mockConfig(values: Record<string, string | boolean | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function jsonResponse(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response;
}

function fetchMock(): jest.MockedFunction<typeof fetch> {
  return global.fetch as jest.MockedFunction<typeof fetch>;
}

function requestBody(callIndex: number): string {
  const init = fetchMock().mock.calls[callIndex]?.[1];
  return typeof init?.body === 'string' ? init.body : '';
}

function requestUrl(callIndex: number): string {
  const url = fetchMock().mock.calls[callIndex]?.[0];
  return typeof url === 'string' ? url : '';
}

describe('KolayBiInvoiceProvider ensureCustomer/Address', () => {
  const originalFetch = global.fetch;
  let provider: KolayBiInvoiceProvider;

  beforeEach(() => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: true,
      }),
    );
    provider = new KolayBiInvoiceProvider(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const individual = {
    localUserId: '11111111-1111-4111-8111-111111111111',
    type: 'INDIVIDUAL' as const,
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    email: 'a@x.com',
    phone: '+905551112233',
    taxOrIdentityNumber: '12345678901',
  };

  it('creates individual associate with form fields from docs', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 7 } }));

    const result = await provider.ensureCustomer(individual, null);
    expect(result).toMatchObject({
      externalId: '7',
      created: true,
      verifiedExisting: false,
    });

    const body = requestBody(1);
    expect(body).toContain('name=Ahmet');
    expect(body).toContain('surname=Y%C4%B1lmaz');
    expect(body).toContain('identity_no=12345678901');
    expect(body).toContain('is_corporate=false');
    expect(body).toContain(
      `code=${encodeURIComponent(associateCodeForUser(individual.localUserId))}`,
    );
  });

  it('creates corporate associate with VKN and tax_office', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 8 } }));

    await provider.ensureCustomer(
      {
        localUserId: '22222222-2222-4222-8222-222222222222',
        type: 'CORPORATE',
        firstName: 'Ali',
        lastName: 'Veli',
        email: 'c@x.com',
        phone: null,
        taxOrIdentityNumber: '1234567890',
        companyName: 'ACME Ltd',
        taxOffice: 'Kadıköy',
      },
      null,
    );

    const body = requestBody(1);
    expect(body).toContain('name=ACME');
    expect(body).toContain('is_corporate=true');
    expect(body).toContain('identity_no=1234567890');
    expect(body).toContain('tax_office=');
  });

  it('verifies existing associate via GET when link present', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 5 } }));

    const result = await provider.ensureCustomer(individual, '5');
    expect(result.created).toBe(false);
    expect(result.verifiedExisting).toBe(true);
    expect(requestUrl(1)).toContain('/associates/5');
  });

  it('recreates associate when existing id returns 404', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(404, 'missing'))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 11 } }));

    const result = await provider.ensureCustomer(individual, '404');
    expect(result.created).toBe(true);
    expect(result.externalId).toBe('11');
  });

  it('resolves duplicate via list?code= on 409', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(409, 'exists'))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: [{ id: 42, code: 'fs-user-x' }] }),
      );

    const result = await provider.ensureCustomer(individual, null);
    expect(result.externalId).toBe('42');
    expect(result.created).toBe(false);
    expect(result.verifiedExisting).toBe(true);
  });

  it('creates address with associate_id', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 3 } }));

    const result = await provider.ensureAddress(
      {
        localAddressId: 'a1',
        localUserId: individual.localUserId,
        providerCustomerId: '10',
        addressLine: 'Test Mah',
        city: 'İstanbul',
        district: 'Kadıköy',
        countryCode: 'TR',
        postalCode: '34710',
        neighborhood: null,
      },
      null,
    );

    expect(result.externalId).toBe('3');
    const body = requestBody(1);
    expect(body).toContain('associate_id=10');
    expect(body).toContain('city=');
    expect(body).toContain('district=');
    expect(body).toContain('country=T');
    expect(body).toContain('address_type=invoice');
  });

  it('skips address create when link exists', async () => {
    global.fetch = jest.fn();
    const result = await provider.ensureAddress(
      {
        localAddressId: 'a1',
        localUserId: individual.localUserId,
        providerCustomerId: '10',
        addressLine: 'X',
        city: 'İstanbul',
        district: 'Kadıköy',
        countryCode: 'TR',
        postalCode: null,
        neighborhood: null,
      },
      '99',
    );
    expect(result.verifiedExisting).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not log TCKN or secrets', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: 'super-secret-bearer-token' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 1 } }));

    await provider.ensureCustomer(individual, null);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('12345678901');
    expect(logged).not.toContain('super-secret-bearer-token');
    expect(logged).not.toContain('Bearer ');
  });

  it('propagates timeout errors', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(
      provider.ensureCustomer(individual, null),
    ).rejects.toBeInstanceOf(KolayBiApiError);
  });
});

describe('KolayBiInvoiceProvider ensureProduct', () => {
  const originalFetch = global.fetch;
  let provider: KolayBiInvoiceProvider;

  beforeEach(() => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: true,
      }),
    );
    provider = new KolayBiInvoiceProvider(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const product = {
    localProductId: '33333333-3333-4333-8333-333333333333',
    sku: 'FS-001',
    name: 'Kompresör',
    description: 'Test açıklama',
    barcode: '8690000000001',
    vatRate: '20.00',
  };

  it('creates product with sku as code, vat_rate, barcode; no price/unit/fake barcode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // code lookup
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // barcode lookup
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 55 } }));

    const result = await provider.ensureProduct(product, null);
    expect(result).toMatchObject({
      externalId: '55',
      created: true,
      verifiedExisting: false,
    });

    expect(requestUrl(1)).toContain('/products?code=FS-001');
    expect(requestUrl(2)).toContain('barcode=8690000000001');
    const body = requestBody(3);
    expect(body).toContain('name=Kompres');
    expect(body).toContain('code=FS-001');
    expect(body).toContain('vat_rate=20.00');
    expect(body).toContain('barcode=8690000000001');
    expect(body).toContain('product_type=good');
    expect(body).not.toContain('price=');
    expect(body).not.toMatch(/(^|&)unit=/);
    expect(body).not.toContain('ADET');
  });

  it('omits barcode when null — does not invent one', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 56 } }));

    await provider.ensureProduct({ ...product, barcode: null }, null);
    const body = requestBody(2);
    expect(body).not.toContain('barcode=');
  });

  it('reuses existing ExternalEntityLink via GET', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 9 } }));

    const result = await provider.ensureProduct(product, '9');
    expect(result.created).toBe(false);
    expect(result.verifiedExisting).toBe(true);
    expect(requestUrl(1)).toContain('/products/9');
  });

  it('links existing KolayBi product found by code without create', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: [{ id: 77, code: 'FS-001' }] }),
      );

    const result = await provider.ensureProduct(product, null);
    expect(result.externalId).toBe('77');
    expect(result.created).toBe(false);
    expect(result.verifiedExisting).toBe(true);
    expect(fetchMock().mock.calls.length).toBe(2);
  });

  it('recreates when linked id returns 404 then creates', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(404, 'missing'))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // code
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // barcode
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 88 } }));

    const result = await provider.ensureProduct(product, '404');
    expect(result.created).toBe(true);
    expect(result.externalId).toBe('88');
  });

  it('resolves 409 via list?code=', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // code
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // barcode
      .mockResolvedValueOnce(jsonResponse(409, 'exists'))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: [{ id: 91, code: 'FS-001' }] }),
      );

    const result = await provider.ensureProduct(product, null);
    expect(result.externalId).toBe('91');
    expect(result.created).toBe(false);
  });

  it('propagates product 400 when unresolved', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // code
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // barcode
      .mockResolvedValueOnce(jsonResponse(400, 'bad'))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // resolve code
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })); // resolve barcode

    await expect(provider.ensureProduct(product, null)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('propagates 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(401, 'nope'));

    await expect(provider.ensureProduct(product, null)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('propagates 429', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(429, 'slow'));

    await expect(provider.ensureProduct(product, null)).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('propagates timeout', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(provider.ensureProduct(product, null)).rejects.toBeInstanceOf(
      KolayBiApiError,
    );
  });

  it('does not log secrets or full product description spam', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: 'super-secret-bearer-token' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // code
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // barcode
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 1 } }));

    await provider.ensureProduct(
      { ...product, description: 'SENSITIVE_DESC_XYZ' },
      null,
    );
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('super-secret-bearer-token');
    expect(logged).not.toContain('Bearer ');
    expect(logged).not.toContain('SENSITIVE_DESC_XYZ');
  });
});

describe('KolayBiInvoiceProvider createInvoice', () => {
  const originalFetch = global.fetch;
  let provider: KolayBiInvoiceProvider;

  beforeEach(() => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: true,
      }),
    );
    provider = new KolayBiInvoiceProvider(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const input = {
    localInvoiceId: 'inv1',
    localSaleId: 'sale1',
    saleNumber: 'S20260918-0001',
    providerCustomerId: '10',
    providerAddressId: '20',
    orderDate: '2026-09-18',
    currency: 'TRY',
    description: 'SALE:sale1',
    receiverEmail: 'c@x.com',
    expectedGrandTotal: '120.00',
    lines: [
      {
        providerProductId: '30',
        description: 'Kompresör',
        quantity: 1,
        unitPriceExclusive: '100.00',
        vatRate: '20.00',
      },
    ],
  };

  it('creates invoice with documented form fields', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] })) // lookup
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { document_id: 1854, grand_total: 120 } }),
      );

    const result = await provider.createInvoice(input);
    expect(result.externalDocumentId).toBe('1854');
    expect(result.created).toBe(true);
    expect(result.uuid).toBeNull();
    expect(result.invoiceNumber).toBe('S20260918-0001');

    const body = requestBody(2);
    expect(body).toContain('contact_id=10');
    expect(body).toContain('address_id=20');
    expect(body).toContain('order_date=2026-09-18');
    expect(body).toContain('currency=try');
    expect(body).toContain('items%5B0%5D%5Bproduct_id%5D=30');
    expect(body).toContain('items%5B0%5D%5Bunit_price%5D=100.00');
    expect(body).toContain('items%5B0%5D%5Bvat_rate%5D=20.00');
    expect(body).toContain('serial_no=S20260918-0001');
    expect(body).toContain('description=SALE%3Asale1');
  });

  it('resolves existing invoice by description before create', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            {
              commercial_doc_id: 99,
              header: {
                serial_no: 'S20260918-0001',
                description: 'SALE:sale1',
              },
              total: { grand_total: 120 },
            },
          ],
        }),
      );

    const result = await provider.createInvoice(input);
    expect(result.externalDocumentId).toBe('99');
    expect(result.created).toBe(false);
    expect(result.resolvedExisting).toBe(true);
    expect(fetchMock().mock.calls.length).toBe(2);
  });

  it('does not log secrets', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: 'super-secret-bearer-token' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { document_id: 1, grand_total: 120 } }),
      );

    await provider.createInvoice(input);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('super-secret-bearer-token');
    expect(logged).not.toContain('Bearer ');
  });
});

describe('KolayBiInvoiceProvider formalizeInvoice', () => {
  const originalFetch = global.fetch;
  let provider: KolayBiInvoiceProvider;

  beforeEach(() => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: true,
      }),
    );
    provider = new KolayBiInvoiceProvider(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const input = {
    localInvoiceId: 'inv1',
    externalDocumentId: '18',
  };

  it('formalizeInvoice posts document_id and maps uuid/no/scenario', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: {} })) // detail no uuid
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            document_id: 18,
            uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
            no: 'HDB2021000008464',
            status: 'sent_to_receiver',
            scenario: 'EARSIVFATURA',
            type: 'SATIS',
          },
        }),
      );

    const result = await provider.formalizeInvoice(input);
    expect(result.uuid).toBe('f46d5a8d-7726-4b37-bba4-973c7ab50a5b');
    expect(result.invoiceNumber).toBe('HDB2021000008464');
    expect(result.providerScenario).toBe('EARSIVFATURA');
    expect(result.resolvedExisting).toBe(false);

    expect(requestUrl(2)).toContain('/invoices/e-document/create');
    const body = requestBody(2);
    expect(body).toContain('document_id=18');
    expect(body).not.toContain('scenario=');
  });

  it('resolves existing formalize via GET detail uuid without create', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { uuid: 'existing-ettn' },
        }),
      );

    const result = await provider.formalizeInvoice(input);
    expect(result.uuid).toBe('existing-ettn');
    expect(result.resolvedExisting).toBe(true);
    expect(fetchMock().mock.calls.length).toBe(2);
  });

  it('on timeout looks up uuid before failing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }))
      .mockImplementationOnce(() => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      })
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { uuid: 'recovered-uuid' } }),
      );

    const result = await provider.formalizeInvoice(input);
    expect(result.uuid).toBe('recovered-uuid');
    expect(result.resolvedExisting).toBe(true);
  });

  it('propagates 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(401, 'nope'));
    await expect(provider.formalizeInvoice(input)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('does not log secrets', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: 'super-secret-bearer-token' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: {
            document_id: 1,
            uuid: 'u1',
            no: 'N1',
          },
        }),
      );

    await provider.formalizeInvoice(input);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('super-secret-bearer-token');
    expect(logged).not.toContain('Bearer ');
  });
});

describe('KolayBiInvoiceProvider document view + remote state', () => {
  const originalFetch = global.fetch;
  let provider: KolayBiInvoiceProvider;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'key',
        KOLAYBI_CHANNEL: 'ch',
        KOLAYBI_SANDBOX: true,
      }),
    );
    provider = new KolayBiInvoiceProvider(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('getInvoiceDocument decodes base64 PDF', async () => {
    const pdfB64 = Buffer.from('%PDF-1.4 test').toString('base64');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { src: pdfB64, output_type: 'pdf' },
        }),
      );

    const result = await provider.getInvoiceDocument({
      uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
      outputType: 'pdf',
    });
    expect(result.contentType).toBe('application/pdf');
    expect(result.body.toString()).toContain('%PDF');
    expect(requestUrl(1)).toContain('/invoices/e-document/view');
    expect(requestUrl(1)).toContain('output_type=pdf');
  });

  it('getInvoiceDocument supports xml output_type', async () => {
    const xmlB64 = Buffer.from('<Invoice xmlns="urn:ubl"/>').toString('base64');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { src: xmlB64, output_type: 'xml' },
        }),
      );

    const result = await provider.getInvoiceDocument({
      uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
      outputType: 'xml',
    });
    expect(result.outputType).toBe('xml');
    expect(result.contentType).toBe('application/xml');
    expect(requestUrl(1)).toContain('output_type=xml');
  });

  it('getInvoiceDocument maps 404', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(404, { message: 'missing' }));

    await expect(
      provider.getInvoiceDocument({ uuid: 'x', outputType: 'pdf' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'KOLAYBI_NOT_FOUND' });
  });

  it('getInvoiceDocument maps 429', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'slow' }));

    await expect(
      provider.getInvoiceDocument({ uuid: 'x', outputType: 'pdf' }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'KOLAYBI_RATE_LIMITED',
      retryable: true,
    });
  });

  it('getInvoiceDocument maps 500', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));

    await expect(
      provider.getInvoiceDocument({ uuid: 'x', outputType: 'pdf' }),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'KOLAYBI_UPSTREAM_ERROR',
    });
  });

  it('getInvoiceDocument maps timeout', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockImplementationOnce(() => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

    await expect(
      provider.getInvoiceDocument({ uuid: 'x', outputType: 'pdf' }),
    ).rejects.toMatchObject({ code: 'KOLAYBI_TIMEOUT', retryable: true });
  });

  it('getInvoiceRemoteState combines detail uuid + list serial/status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { uuid: 'ettn-z' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            {
              commercial_doc_id: 18,
              e_document_status: 'sent_to_receiver',
              commercial_doc_status: { value: 'sent' },
              header: {
                serial_no: 'HDB2021000008464',
                description: 'SALE:sale1',
              },
            },
          ],
        }),
      );

    const state = await provider.getInvoiceRemoteState({
      externalDocumentId: '18',
      description: 'SALE:sale1',
    });
    expect(state.uuid).toBe('ettn-z');
    expect(state.invoiceNumber).toBe('HDB2021000008464');
    expect(state.providerEDocumentStatus).toBe('sent_to_receiver');
    expect(state.providerCommercialStatus).toBe('sent');
  });
});
