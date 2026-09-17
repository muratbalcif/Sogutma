import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCorporateCustomerInput {
  userId: string;
  companyName: string;
  taxNumber: string;
  taxOffice: string;
  identityNumber?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  createCorporateProfile(input: CreateCorporateCustomerInput) {
    return this.prisma.corporateCustomer.create({
      data: {
        userId: input.userId,
        companyName: input.companyName,
        taxNumber: input.taxNumber,
        taxOffice: input.taxOffice,
        identityNumber: input.identityNumber,
      },
    });
  }

  findByUserId(userId: string) {
    return this.prisma.corporateCustomer.findUnique({ where: { userId } });
  }
}
