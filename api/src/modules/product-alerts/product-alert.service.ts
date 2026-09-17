import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProductAlertResponseDto,
  TriggerAlertResultDto,
} from './dto/product-alert.dto';

/**
 * Product stock alerts.
 *
 * Business decision: alerts may be created for any existing product,
 * including inactive ones. Users often want notification when a product
 * returns to availability (stock or reactivation). Push delivery is out
 * of scope for this milestone — triggerAlert only marks records.
 */
@Injectable()
export class ProductAlertService {
  constructor(private readonly prisma: PrismaService) {}

  async createAlert(
    userId: string,
    productId: string,
  ): Promise<ProductAlertResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true, sku: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const alert = await this.prisma.productAlert.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: {
        userId,
        productId,
        active: true,
        triggeredAt: null,
      },
      update: {
        active: true,
        triggeredAt: null,
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true },
        },
      },
    });

    return this.toResponse(alert);
  }

  async removeAlert(
    userId: string,
    productId: string,
  ): Promise<{ success: true }> {
    await this.prisma.productAlert.deleteMany({
      where: { userId, productId },
    });
    return { success: true };
  }

  async getUserAlerts(userId: string): Promise<ProductAlertResponseDto[]> {
    const alerts = await this.prisma.productAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true },
        },
      },
    });
    return alerts.map((alert) => this.toResponse(alert));
  }

  async findTriggeredCandidates(productId: string): Promise<string[]> {
    const alerts = await this.prisma.productAlert.findMany({
      where: {
        productId,
        active: true,
        triggeredAt: null,
      },
      select: { userId: true },
    });
    return alerts.map((alert) => alert.userId);
  }

  async triggerAlert(productId: string): Promise<TriggerAlertResultDto> {
    const candidates = await this.findTriggeredCandidates(productId);
    if (candidates.length === 0) {
      return { productId, triggeredCount: 0, userIds: [] };
    }

    const now = new Date();
    await this.prisma.productAlert.updateMany({
      where: {
        productId,
        active: true,
        triggeredAt: null,
        userId: { in: candidates },
      },
      data: {
        active: false,
        triggeredAt: now,
      },
    });

    return {
      productId,
      triggeredCount: candidates.length,
      userIds: candidates,
    };
  }

  private toResponse(alert: {
    id: string;
    productId: string;
    active: boolean;
    triggeredAt: Date | null;
    createdAt: Date;
    product?: {
      id: string;
      name: string;
      slug: string;
      sku: string;
    };
  }): ProductAlertResponseDto {
    return {
      id: alert.id,
      productId: alert.productId,
      active: alert.active,
      triggeredAt: alert.triggeredAt,
      createdAt: alert.createdAt,
      product: alert.product,
    };
  }
}
