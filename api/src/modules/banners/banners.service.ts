import { Injectable, NotFoundException } from '@nestjs/common';
import { BannerLinkType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BannerResponseDto,
  CreateBannerDto,
  UpdateBannerDto,
} from './dto/banner.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<BannerResponseDto[]> {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return banners.map((b) => this.toResponse(b));
  }

  async listAdmin(): Promise<BannerResponseDto[]> {
    const banners = await this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return banners.map((b) => this.toResponse(b));
  }

  async getAdminById(id: string): Promise<BannerResponseDto> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return this.toResponse(banner);
  }

  async create(dto: CreateBannerDto): Promise<BannerResponseDto> {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl,
        linkType: dto.linkType ?? BannerLinkType.NONE,
        linkValue: dto.linkValue,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
    return this.toResponse(banner);
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerResponseDto> {
    await this.getAdminById(id);
    const data: Prisma.BannerUpdateInput = {
      title: dto.title,
      imageUrl: dto.imageUrl,
      linkType: dto.linkType,
      sortOrder: dto.sortOrder,
      active: dto.active,
    };
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
    if (dto.mobileImageUrl !== undefined)
      data.mobileImageUrl = dto.mobileImageUrl;
    if (dto.linkValue !== undefined) data.linkValue = dto.linkValue;
    if (dto.startsAt !== undefined) {
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }

    const banner = await this.prisma.banner.update({ where: { id }, data });
    return this.toResponse(banner);
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.getAdminById(id);
    await this.prisma.banner.update({
      where: { id },
      data: { active: false },
    });
    return { success: true };
  }

  private toResponse(banner: {
    id: string;
    title: string;
    subtitle: string | null;
    imageUrl: string;
    mobileImageUrl: string | null;
    linkType: BannerLinkType;
    linkValue: string | null;
    sortOrder: number;
    active: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  }): BannerResponseDto {
    return { ...banner };
  }
}
