import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brand } from '@prisma/client';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BrandResponseDto,
  CreateBrandDto,
  UpdateBrandDto,
} from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      active: brand.active,
    };
  }

  async findPublicAll(): Promise<BrandResponseDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return brands.map((brand) => this.toResponse(brand));
  }

  async findPublicBySlug(slug: string): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, active: true },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return this.toResponse(brand);
  }

  async findAllAdmin(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<BrandResponseDto>> {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.brand.count(),
      this.prisma.brand.findMany({
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => this.toResponse(item)),
      total,
      query.page,
      query.limit,
    );
  }

  async create(dto: CreateBrandDto): Promise<BrandResponseDto> {
    await this.ensureSlugAvailable(dto.slug);
    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logo: dto.logo,
        active: dto.active ?? true,
      },
    });
    return this.toResponse(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandResponseDto> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Brand not found');
    }
    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureSlugAvailable(dto.slug);
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        logo: dto.logo,
        active: dto.active,
      },
    });
    return this.toResponse(brand);
  }

  async softDelete(id: string): Promise<BrandResponseDto> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Brand not found');
    }
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { active: false },
    });
    return this.toResponse(brand);
  }

  private async ensureSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Brand slug already exists');
    }
  }
}
