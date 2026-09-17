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
});
