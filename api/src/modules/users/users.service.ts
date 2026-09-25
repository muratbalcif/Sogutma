import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserStatus, UserType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: UserType;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(
    user: User,
    access: { roles?: string[]; permissions?: string[] } = {},
  ): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType,
      status: user.status,
      roles: access.roles ?? [],
      permissions: access.permissions ?? [],
    };
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        userType: input.userType,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Closes the storefront account without removing orders, invoices, or ledger rows.
   * Personal fields are replaced so the original email can be registered again.
   */
  async anonymizeAccount(id: string, passwordHash: string): Promise<void> {
    const admin = await this.prisma.adminUser.findUnique({ where: { userId: id } });
    if (admin) {
      throw new ForbiddenException('Yönetici hesapları buradan silinemez');
    }

    const deletedEmail = `deleted.${id}@deleted.furkansogutma.invalid`;
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.deviceToken.deleteMany({ where: { userId: id } });
      await tx.favorite.deleteMany({ where: { userId: id } });
      await tx.productAlert.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.notificationPreference.deleteMany({ where: { userId: id } });
      await tx.cart.deleteMany({ where: { userId: id } });
      await tx.address.updateMany({
        where: { userId: id },
        data: {
          firstName: 'Silinmiş',
          lastName: 'Kullanıcı',
          phone: '0000000000',
          addressLine: 'Silindi',
          neighborhood: null,
        },
      });
      await tx.corporateCustomer.updateMany({
        where: { userId: id },
        data: {
          companyName: 'Silinmiş',
          identityNumber: null,
        },
      });
      await tx.user.update({
        where: { id },
        data: {
          email: deletedEmail,
          passwordHash,
          firstName: 'Silinmiş',
          lastName: 'Kullanıcı',
          phone: null,
          identityNumber: null,
          status: UserStatus.INACTIVE,
        },
      });
    });
  }

  async updateProfile(
    id: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
  }
}
