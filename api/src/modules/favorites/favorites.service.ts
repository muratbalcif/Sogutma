import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FavoriteCheckResponseDto,
  FavoriteResponseDto,
} from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FavoriteResponseDto[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    return favorites.map((favorite) => this.toResponse(favorite));
  }

  async add(userId: string, productId: string): Promise<FavoriteResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, active: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.active) {
      throw new BadRequestException('Only active products can be favorited');
    }

    const favorite = await this.prisma.favorite.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: { userId, productId },
      update: {},
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    return this.toResponse(favorite);
  }

  async remove(userId: string, productId: string): Promise<{ success: true }> {
    await this.prisma.favorite.deleteMany({
      where: { userId, productId },
    });
    return { success: true };
  }

  async check(
    userId: string,
    productId: string,
  ): Promise<FavoriteCheckResponseDto> {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
      select: { id: true },
    });
    return {
      productId,
      isFavorite: Boolean(favorite),
    };
  }

  private toResponse(favorite: {
    id: string;
    productId: string;
    createdAt: Date;
    product: {
      id: string;
      name: string;
      slug: string;
      sku: string;
      images: Array<{
        id: string;
        url: string;
        alt: string | null;
        sortOrder: number;
        isPrimary: boolean;
      }>;
    };
  }): FavoriteResponseDto {
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt,
      product: {
        id: favorite.product.id,
        name: favorite.product.name,
        slug: favorite.product.slug,
        sku: favorite.product.sku,
        images: favorite.product.images.map((image) => ({
          id: image.id,
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      },
    };
  }
}
