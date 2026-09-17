import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddressResponseDto,
  AddressSnapshot,
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    if (dto.isDefault) {
      await this.clearDefaults(userId);
    }
    const address = await this.prisma.address.create({
      data: {
        userId,
        title: dto.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        city: dto.city,
        district: dto.district,
        neighborhood: dto.neighborhood,
        addressLine: dto.addressLine,
        postalCode: dto.postalCode,
        country: dto.country ?? 'TR',
        isDefault: dto.isDefault ?? false,
      },
    });
    return this.toResponse(address);
  }

  async list(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses.map((address) => this.toResponse(address));
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    await this.getOwned(userId, addressId);
    if (dto.isDefault) {
      await this.clearDefaults(userId);
    }
    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        title: dto.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        city: dto.city,
        district: dto.district,
        neighborhood: dto.neighborhood,
        addressLine: dto.addressLine,
        postalCode: dto.postalCode,
        country: dto.country,
        isDefault: dto.isDefault,
      },
    });
    return this.toResponse(address);
  }

  async remove(userId: string, addressId: string): Promise<{ success: true }> {
    await this.getOwned(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }

  async getOwned(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Address does not belong to user');
    }
    return address;
  }

  toSnapshot(address: {
    title: string;
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    district: string;
    neighborhood: string | null;
    addressLine: string;
    postalCode: string | null;
    country: string;
  }): AddressSnapshot {
    return {
      title: address.title,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      city: address.city,
      district: address.district,
      neighborhood: address.neighborhood,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      country: address.country,
    };
  }

  private async clearDefaults(userId: string): Promise<void> {
    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private toResponse(address: {
    id: string;
    title: string;
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    district: string;
    neighborhood: string | null;
    addressLine: string;
    postalCode: string | null;
    country: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AddressResponseDto {
    return {
      id: address.id,
      title: address.title,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      city: address.city,
      district: address.district,
      neighborhood: address.neighborhood,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
