import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      image: category.image,
      sortOrder: category.sortOrder,
      active: category.active,
    };
  }

  async findPublicTree(): Promise<CategoryTreeNodeDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return this.buildTree(categories);
  }

  async findPublicBySlug(slug: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: { slug, active: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.toResponse(category);
  }

  async findAllAdmin(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    const where: Prisma.CategoryWhereInput = {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    await this.ensureSlugAvailable(dto.slug);
    if (dto.parentId) {
      await this.ensureParentExists(dto.parentId);
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
        image: dto.image,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });

    return this.toResponse(category);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureSlugAvailable(dto.slug);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      if (dto.parentId) {
        await this.ensureParentExists(dto.parentId);
        await this.ensureNoCycle(id, dto.parentId);
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
        image: dto.image,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    return this.toResponse(category);
  }

  async softDelete(id: string): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id, active: true } }),
      this.prisma.product.count({ where: { categoryId: id, active: true } }),
    ]);

    // Never hard-delete when children/products exist; soft-deactivate instead.
    if (childCount > 0 || productCount > 0) {
      const category = await this.prisma.category.update({
        where: { id },
        data: { active: false },
      });
      return this.toResponse(category);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: { active: false },
    });

    return this.toResponse(category);
  }

  private async ensureSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Category slug already exists');
    }
  }

  private async ensureParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new BadRequestException('Parent category not found');
    }
  }

  private async ensureNoCycle(
    categoryId: string,
    parentId: string,
  ): Promise<void> {
    let currentId: string | null = parentId;
    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException(
          'Invalid parent: would create a category cycle',
        );
      }
      const parent: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = parent?.parentId ?? null;
    }
  }

  private buildTree(categories: Category[]): CategoryTreeNodeDto[] {
    const nodes = new Map<string, CategoryTreeNodeDto>();
    for (const category of categories) {
      nodes.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        image: category.image,
        sortOrder: category.sortOrder,
        children: [],
      });
    }

    const roots: CategoryTreeNodeDto[] = [];
    for (const category of categories) {
      const node = nodes.get(category.id)!;
      if (category.parentId && nodes.has(category.parentId)) {
        nodes.get(category.parentId)!.children.push(node);
      } else if (!category.parentId) {
        roots.push(node);
      }
    }

    return roots;
  }
}
