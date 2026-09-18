import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExternalEntityType, UserStatus, UserType } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { KolayBiApiError } from './clients/kolaybi.errors';
import type { InvoiceProvider } from './providers/invoice-provider.interface';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';

describe('InvoicesService sync', () => {
  const ensureCustomer = jest.fn();
  const ensureAddress = jest.fn();
  const ensureProduct = jest.fn();
  const createInvoice = jest.fn();
  const provider: InvoiceProvider = {
    code: KOLAYBI_INVOICE_PROVIDER,
    enabled: true,
    authenticate: jest.fn(),
    healthCheck: jest.fn(),
    ensureCustomer,
    ensureAddress,
    ensureProduct,
    createInvoice,
  };

  const prisma = {
    user: { findUnique: jest.fn() },
    address: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    externalEntityLink: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const service = new InvoicesService([provider], prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    ensureCustomer.mockResolvedValue({
      provider: 'KOLAYBI',
      localEntityId: 'u1',
      externalId: '10',
      created: true,
      verifiedExisting: false,
    });
    ensureAddress.mockResolvedValue({
      provider: 'KOLAYBI',
      localEntityId: 'a1',
      externalId: '20',
      created: true,
      verifiedExisting: false,
    });
    ensureProduct.mockResolvedValue({
      provider: 'KOLAYBI',
      localEntityId: 'p1',
      externalId: '30',
      created: true,
      verifiedExisting: false,
    });
    prisma.externalEntityLink.upsert.mockResolvedValue({});
  });

  it('creates associate for individual user and stores ExternalEntityLink', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: '555',
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);

    const result = await service.syncCustomer('u1');

    expect(ensureCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INDIVIDUAL',
        taxOrIdentityNumber: '12345678901',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
      }),
      null,
    );
    expect(prisma.externalEntityLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        create: expect.objectContaining({
          entityType: ExternalEntityType.USER,
          entityId: 'u1',
          externalId: '10',
        }),
      }),
    );
    expect(result.created).toBe(true);
    expect(result.externalId).toBe('10');
  });

  it('creates associate for corporate user with VKN + tax office', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'c@x.com',
      phone: null,
      identityNumber: null,
      userType: UserType.CORPORATE,
      status: UserStatus.ACTIVE,
      corporateCustomer: {
        companyName: 'ACME Ltd',
        taxNumber: '1234567890',
        taxOffice: 'Kadıköy',
      },
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);

    await service.syncCustomer('u2');

    expect(ensureCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CORPORATE',
        companyName: 'ACME Ltd',
        taxOrIdentityNumber: '1234567890',
        taxOffice: 'Kadıköy',
      }),
      null,
    );
  });

  it('passes existing ExternalEntityLink to provider for update/verify', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue({
      externalId: '99',
    });
    ensureCustomer.mockResolvedValue({
      provider: 'KOLAYBI',
      localEntityId: 'u1',
      externalId: '99',
      created: false,
      verifiedExisting: true,
    });

    const result = await service.syncCustomer('u1');
    expect(ensureCustomer).toHaveBeenCalledWith(expect.anything(), '99');
    expect(result.verifiedExisting).toBe(true);
    expect(result.created).toBe(false);
  });

  it('rejects individual without TCKN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: null,
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });

    await expect(service.syncCustomer('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ensureCustomer).not.toHaveBeenCalled();
  });

  it('rejects corporate without VKN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'c@x.com',
      phone: null,
      identityNumber: null,
      userType: UserType.CORPORATE,
      status: UserStatus.ACTIVE,
      corporateCustomer: {
        companyName: 'ACME',
        taxNumber: '123',
        taxOffice: 'Kadıköy',
      },
    });

    await expect(service.syncCustomer('u2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('syncs address after ensuring customer link', async () => {
    prisma.address.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      city: 'İstanbul',
      district: 'Kadıköy',
      addressLine: 'Test Mah. No:1',
      country: 'TR',
      postalCode: '34710',
      neighborhood: null,
    });
    prisma.externalEntityLink.findUnique
      .mockResolvedValueOnce({ externalId: '10' }) // user link
      .mockResolvedValueOnce(null); // address link

    const result = await service.syncAddress('a1');

    expect(ensureAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCustomerId: '10',
        city: 'İstanbul',
        district: 'Kadıköy',
      }),
      null,
    );
    expect(result.externalId).toBe('20');
  });

  it('404 when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.syncCustomer('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps KolayBi 400 to HttpException', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    ensureCustomer.mockRejectedValue(
      new KolayBiApiError('bad', 400, 'KOLAYBI_VALIDATION_ERROR', false),
    );

    await expect(service.syncCustomer('u1')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('maps KolayBi 401', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    ensureCustomer.mockRejectedValue(
      new KolayBiApiError('unauth', 401, 'KOLAYBI_UNAUTHORIZED', false),
    );

    await expect(service.syncCustomer('u1')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('maps 429/timeout as 503 ServiceUnavailable', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    ensureCustomer.mockRejectedValue(
      new KolayBiApiError('rate', 429, 'KOLAYBI_RATE_LIMITED', true),
    );

    await expect(service.syncCustomer('u1')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('surfaces ExternalEntityLink DB errors', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'a@x.com',
      phone: null,
      identityNumber: '12345678901',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
      corporateCustomer: null,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    prisma.externalEntityLink.upsert.mockRejectedValue(new Error('db down'));

    await expect(service.syncCustomer('u1')).rejects.toThrow('db down');
  });

  it('resolves KOLAYBI provider', () => {
    expect(service.resolveProvider('KOLAYBI').code).toBe('KOLAYBI');
  });

  it('syncs product and stores PRODUCT ExternalEntityLink with vatRate toFixed', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      sku: 'FS-001',
      name: 'Kompresör',
      description: null,
      barcode: '8690000000001',
      vatRate: { toFixed: () => '20.00' },
      active: true,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);

    const result = await service.syncProduct('p1');
    expect(ensureProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        localProductId: 'p1',
        sku: 'FS-001',
        barcode: '8690000000001',
        vatRate: '20.00',
      }),
      null,
    );
    expect(prisma.externalEntityLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        create: expect.objectContaining({
          entityType: ExternalEntityType.PRODUCT,
          entityId: 'p1',
          externalId: '30',
        }),
      }),
    );
    expect(result.sku).toBe('FS-001');
    expect(result.externalId).toBe('30');
  });

  it('reuses product ExternalEntityLink on ensureProduct', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      sku: 'FS-001',
      name: 'Kompresör',
      description: null,
      barcode: null,
      vatRate: { toFixed: () => '20.00' },
      active: true,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue({
      externalId: '30',
    });
    ensureProduct.mockResolvedValue({
      provider: 'KOLAYBI',
      localEntityId: 'p1',
      externalId: '30',
      created: false,
      verifiedExisting: true,
    });

    const result = await service.syncProduct('p1');
    expect(ensureProduct).toHaveBeenCalledWith(expect.anything(), '30');
    expect(result.verifiedExisting).toBe(true);
  });

  it('rejects product missing sku/name', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      sku: '  ',
      name: 'X',
      description: null,
      barcode: null,
      vatRate: { toFixed: () => '20.00' },
      active: true,
    });
    await expect(service.syncProduct('p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ensureProduct).not.toHaveBeenCalled();
  });

  it('maps product provider 401 to http', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      sku: 'FS-001',
      name: 'Kompresör',
      description: null,
      barcode: null,
      vatRate: { toFixed: () => '20.00' },
      active: true,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    ensureProduct.mockRejectedValue(
      new KolayBiApiError('unauthorized', 401, 'KOLAYBI_UNAUTHORIZED', false),
    );
    await expect(service.syncProduct('p1')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('surfaces ExternalEntityLink DB failure after product ensure', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      sku: 'FS-001',
      name: 'Kompresör',
      description: null,
      barcode: null,
      vatRate: { toFixed: () => '20.00' },
      active: true,
    });
    prisma.externalEntityLink.findUnique.mockResolvedValue(null);
    prisma.externalEntityLink.upsert.mockRejectedValue(new Error('db down'));
    await expect(service.syncProduct('p1')).rejects.toThrow('db down');
  });

  it('resolves provider KOLAYBI for product sync', async () => {
    await expect(service.syncProduct('p1', 'UNKNOWN')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
