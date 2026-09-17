import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUpsertBankAccountDto,
  PublicBankAccountDto,
} from './dto/payment.dto';

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<PublicBankAccountDto[]> {
    const accounts = await this.prisma.companyBankAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { bankName: 'asc' }],
    });
    return accounts.map((account) => this.toPublic(account));
  }

  async listAdmin(): Promise<
    Array<
      PublicBankAccountDto & { active: boolean; accountNumber: string | null }
    >
  > {
    const accounts = await this.prisma.companyBankAccount.findMany({
      orderBy: [{ sortOrder: 'asc' }, { bankName: 'asc' }],
    });
    return accounts.map((account) => ({
      ...this.toPublic(account),
      active: account.active,
      accountNumber: account.accountNumber,
    }));
  }

  async upsertAdmin(
    id: string | null,
    dto: AdminUpsertBankAccountDto,
  ): Promise<PublicBankAccountDto & { active: boolean }> {
    const data = {
      bankName: dto.bankName,
      accountName: dto.accountName,
      iban: dto.iban.replace(/\s+/g, '').toUpperCase(),
      branch: dto.branch ?? null,
      accountNumber: dto.accountNumber ?? null,
      currency: dto.currency ?? 'TRY',
      description: dto.description ?? null,
      active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };

    const account = id
      ? await this.prisma.companyBankAccount.update({ where: { id }, data })
      : await this.prisma.companyBankAccount.create({ data });

    return { ...this.toPublic(account), active: account.active };
  }

  async setActive(id: string, active: boolean): Promise<PublicBankAccountDto> {
    try {
      const account = await this.prisma.companyBankAccount.update({
        where: { id },
        data: { active },
      });
      return this.toPublic(account);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Bank account not found');
      }
      throw error;
    }
  }

  async requireActive(id: string): Promise<{ id: string }> {
    const account = await this.prisma.companyBankAccount.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }
    return account;
  }

  private toPublic(account: {
    id: string;
    bankName: string;
    accountName: string;
    iban: string;
    branch: string | null;
    currency: string;
    description: string | null;
    sortOrder: number;
  }): PublicBankAccountDto {
    return {
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      iban: account.iban,
      branch: account.branch,
      currency: account.currency,
      description: account.description,
      sortOrder: account.sortOrder,
    };
  }
}
