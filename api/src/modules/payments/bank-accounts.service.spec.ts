import { BankAccountsService } from './bank-accounts.service';

describe('BankAccountsService', () => {
  const prisma = {
    companyBankAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new BankAccountsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists only active accounts for public endpoint', async () => {
    prisma.companyBankAccount.findMany.mockResolvedValue([
      {
        id: '1',
        bankName: 'Ziraat',
        accountName: 'Furkan',
        iban: 'TR330006100519786457841326',
        branch: null,
        currency: 'TRY',
        description: null,
        sortOrder: 0,
        active: true,
      },
    ]);

    const result = await service.listPublic();
    expect(prisma.companyBankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(result[0].iban).toBe('TR330006100519786457841326');
    expect(result[0]).not.toHaveProperty('active');
  });

  it('lists all accounts for admin including inactive', async () => {
    prisma.companyBankAccount.findMany.mockResolvedValue([
      {
        id: '1',
        bankName: 'Ziraat',
        accountName: 'Furkan',
        iban: 'TR330006100519786457841326',
        branch: null,
        accountNumber: '123',
        currency: 'TRY',
        description: null,
        sortOrder: 0,
        active: false,
      },
    ]);

    const result = await service.listAdmin();
    expect(prisma.companyBankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { bankName: 'asc' }],
      }),
    );
    expect(result[0].active).toBe(false);
    expect(result[0].accountNumber).toBe('123');
  });

  it('creates bank account and normalizes IBAN', async () => {
    prisma.companyBankAccount.create.mockResolvedValue({
      id: 'new',
      bankName: 'Garanti',
      accountName: 'Furkan',
      iban: 'TR330006100519786457841326',
      branch: null,
      accountNumber: null,
      currency: 'TRY',
      description: null,
      sortOrder: 1,
      active: true,
    });

    const result = await service.upsertAdmin(null, {
      bankName: 'Garanti',
      accountName: 'Furkan',
      iban: 'tr33 0006 1005 1978 6457 8413 26',
      sortOrder: 1,
      active: true,
    });

    expect(prisma.companyBankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        iban: 'TR330006100519786457841326',
        active: true,
      }),
    });
    expect(result.id).toBe('new');
    expect(result.active).toBe(true);
  });

  it('deactivates via upsertAdmin active=false', async () => {
    prisma.companyBankAccount.update.mockResolvedValue({
      id: '1',
      bankName: 'Ziraat',
      accountName: 'Furkan',
      iban: 'TR330006100519786457841326',
      branch: null,
      accountNumber: null,
      currency: 'TRY',
      description: null,
      sortOrder: 0,
      active: false,
    });

    const result = await service.upsertAdmin('1', {
      bankName: 'Ziraat',
      accountName: 'Furkan',
      iban: 'TR330006100519786457841326',
      active: false,
    });

    expect(prisma.companyBankAccount.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: expect.objectContaining({ active: false }),
    });
    expect(result.active).toBe(false);
  });
});
