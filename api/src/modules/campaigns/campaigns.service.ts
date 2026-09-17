import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignType, Prisma } from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddCampaignProductDto,
  CampaignProductResponseDto,
  CampaignResponseDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  UpdateCampaignProductDto,
} from './dto/campaign.dto';
import {
  CampaignOfferInput,
  selectBestCampaignOffer,
} from './campaign-pricing.util';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(): Promise<CampaignResponseDto[]> {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    });
    return campaigns.map((c) => this.toCampaignResponse(c));
  }

  async getPublicBySlug(slug: string): Promise<CampaignResponseDto> {
    const now = new Date();
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        slug,
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toCampaignResponse(campaign);
  }

  /**
   * Landing page: returns campaign even if expired (client shows ended state).
   * Eligibility for pricing still uses active window only via resolveCampaignPrice.
   */
  async getLandingBySlug(
    slug: string,
  ): Promise<
    CampaignResponseDto & { status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' }
  > {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const now = new Date();
    let status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' = 'INACTIVE';
    if (campaign.active && campaign.startsAt <= now && campaign.endsAt >= now) {
      status = 'ACTIVE';
    } else if (campaign.endsAt < now) {
      status = 'EXPIRED';
    }
    return { ...this.toCampaignResponse(campaign), status };
  }

  async listPublicProducts(
    slug: string,
  ): Promise<CampaignProductResponseDto[]> {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const products = await this.prisma.campaignProduct.findMany({
      where: { campaignId: campaign.id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return products.map((item) => this.toProductResponse(item));
  }

  async listAdmin(): Promise<CampaignResponseDto[]> {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return campaigns.map((c) => this.toCampaignResponse(c));
  }

  async getAdminById(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toCampaignResponse(campaign);
  }

  async listAdminProducts(
    campaignId: string,
  ): Promise<CampaignProductResponseDto[]> {
    await this.getAdminById(campaignId);
    const products = await this.prisma.campaignProduct.findMany({
      where: { campaignId },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return products.map((item) => this.toProductResponse(item));
  }

  async create(
    dto: CreateCampaignDto,
    adminUserId?: string,
  ): Promise<CampaignResponseDto> {
    this.assertDateRange(dto.startsAt, dto.endsAt);
    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          type: dto.type,
          active: dto.active ?? true,
          priority: dto.priority ?? 0,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
        },
      });
      if (adminUserId) {
        await this.audit.log({
          adminUserId,
          action: 'CAMPAIGN_CREATED',
          entityType: 'Campaign',
          entityId: campaign.id,
          metadata: { slug: campaign.slug },
        });
      }
      return this.toCampaignResponse(campaign);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Campaign slug already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCampaignDto,
    adminUserId?: string,
  ): Promise<CampaignResponseDto> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }
    const startsAt = dto.startsAt ?? existing.startsAt.toISOString();
    const endsAt = dto.endsAt ?? existing.endsAt.toISOString();
    this.assertDateRange(startsAt, endsAt);

    try {
      const campaign = await this.prisma.campaign.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          type: dto.type,
          active: dto.active,
          priority: dto.priority,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        },
      });
      if (adminUserId) {
        const action =
          dto.active === undefined
            ? 'CAMPAIGN_UPDATED'
            : dto.active
              ? 'CAMPAIGN_ACTIVATED'
              : 'CAMPAIGN_DEACTIVATED';
        await this.audit.log({
          adminUserId,
          action,
          entityType: 'Campaign',
          entityId: id,
          metadata: { slug: campaign.slug },
        });
      }
      return this.toCampaignResponse(campaign);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Campaign slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string, adminUserId?: string): Promise<{ success: true }> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }
    await this.prisma.campaign.update({
      where: { id },
      data: { active: false },
    });
    if (adminUserId) {
      await this.audit.log({
        adminUserId,
        action: 'CAMPAIGN_DEACTIVATED',
        entityType: 'Campaign',
        entityId: id,
      });
    }
    return { success: true };
  }

  async addProduct(
    campaignId: string,
    dto: AddCampaignProductDto,
  ): Promise<CampaignProductResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    this.assertProductFieldsForType(campaign.type, dto);

    try {
      const item = await this.prisma.campaignProduct.create({
        data: {
          campaignId,
          productId: dto.productId,
          discountPercentage: dto.discountPercentage
            ? new Prisma.Decimal(dto.discountPercentage)
            : null,
          discountAmount: dto.discountAmount
            ? new Prisma.Decimal(dto.discountAmount)
            : null,
          specialPrice: dto.specialPrice
            ? new Prisma.Decimal(dto.specialPrice)
            : null,
        },
        include: {
          product: {
            select: { id: true, name: true, slug: true, sku: true },
          },
        },
      });
      return this.toProductResponse(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Product already in campaign');
      }
      throw error;
    }
  }

  async updateProduct(
    campaignId: string,
    productId: string,
    dto: UpdateCampaignProductDto,
  ): Promise<CampaignProductResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const existing = await this.prisma.campaignProduct.findUnique({
      where: { campaignId_productId: { campaignId, productId } },
    });
    if (!existing) {
      throw new NotFoundException('Campaign product not found');
    }

    const next = {
      discountPercentage:
        dto.discountPercentage === undefined
          ? existing.discountPercentage?.toFixed(2)
          : dto.discountPercentage,
      discountAmount:
        dto.discountAmount === undefined
          ? existing.discountAmount?.toFixed(2)
          : dto.discountAmount,
      specialPrice:
        dto.specialPrice === undefined
          ? existing.specialPrice?.toFixed(2)
          : dto.specialPrice,
    };
    this.assertProductFieldsForType(campaign.type, {
      productId,
      discountPercentage: next.discountPercentage ?? undefined,
      discountAmount: next.discountAmount ?? undefined,
      specialPrice: next.specialPrice ?? undefined,
    });

    const item = await this.prisma.campaignProduct.update({
      where: { id: existing.id },
      data: {
        discountPercentage:
          next.discountPercentage == null
            ? null
            : new Prisma.Decimal(next.discountPercentage),
        discountAmount:
          next.discountAmount == null
            ? null
            : new Prisma.Decimal(next.discountAmount),
        specialPrice:
          next.specialPrice == null
            ? null
            : new Prisma.Decimal(next.specialPrice),
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true },
        },
      },
    });
    return this.toProductResponse(item);
  }

  async removeProduct(
    campaignId: string,
    productId: string,
  ): Promise<{ success: true }> {
    await this.prisma.campaignProduct.deleteMany({
      where: { campaignId, productId },
    });
    return { success: true };
  }

  /**
   * Controlled foundation: enqueue a single outbox job.
   * Does not mass-notify all users synchronously.
   */
  async queueNotify(campaignId: string): Promise<{ queued: true }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    await this.prisma.notificationOutbox.create({
      data: {
        type: 'CAMPAIGN_ANNOUNCE',
        aggregateType: 'CAMPAIGN',
        aggregateId: campaignId,
        payload: {
          campaignId,
          title: campaign.name,
          body: campaign.description ?? `Yeni kampanya: ${campaign.name}`,
        },
      },
    });
    return { queued: true };
  }

  /**
   * Resolves the best active Campaign-module price for a product against retail base.
   */
  async resolveCampaignPrice(
    productId: string,
    retailBase: Prisma.Decimal,
    now = new Date(),
  ): Promise<{ amount: Prisma.Decimal; campaignId: string } | null> {
    const rows = await this.prisma.campaignProduct.findMany({
      where: {
        productId,
        campaign: {
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      },
      include: {
        campaign: {
          select: { id: true, type: true, priority: true },
        },
      },
    });

    const offers: CampaignOfferInput[] = rows.map((row) => ({
      campaignId: row.campaign.id,
      campaignType: row.campaign.type,
      priority: row.campaign.priority,
      discountPercentage: row.discountPercentage,
      discountAmount: row.discountAmount,
      specialPrice: row.specialPrice,
    }));

    const best = selectBestCampaignOffer(retailBase, offers);
    if (!best) {
      return null;
    }
    return { amount: best.price, campaignId: best.offer.campaignId };
  }

  private assertDateRange(
    startsAt: string | Date,
    endsAt: string | Date,
  ): void {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private assertProductFieldsForType(
    type: CampaignType,
    dto: {
      productId: string;
      discountPercentage?: string | null;
      discountAmount?: string | null;
      specialPrice?: string | null;
    },
  ): void {
    const hasPct =
      dto.discountPercentage != null && dto.discountPercentage !== '';
    const hasAmt = dto.discountAmount != null && dto.discountAmount !== '';
    const hasSpecial = dto.specialPrice != null && dto.specialPrice !== '';

    if (type === CampaignType.PERCENTAGE) {
      if (!hasPct || hasAmt || hasSpecial) {
        throw new BadRequestException(
          'PERCENTAGE campaigns require only discountPercentage',
        );
      }
    } else if (type === CampaignType.FIXED_AMOUNT) {
      if (!hasAmt || hasPct || hasSpecial) {
        throw new BadRequestException(
          'FIXED_AMOUNT campaigns require only discountAmount',
        );
      }
    } else if (type === CampaignType.SPECIAL_PRICE) {
      if (!hasSpecial || hasPct || hasAmt) {
        throw new BadRequestException(
          'SPECIAL_PRICE campaigns require only specialPrice',
        );
      }
    }
  }

  private toCampaignResponse(campaign: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: CampaignType;
    active: boolean;
    priority: number;
    startsAt: Date;
    endsAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): CampaignResponseDto {
    return { ...campaign };
  }

  private toProductResponse(item: {
    id: string;
    campaignId: string;
    productId: string;
    discountPercentage: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    specialPrice: Prisma.Decimal | null;
    product?: {
      id: string;
      name: string;
      slug: string;
      sku: string;
    };
  }): CampaignProductResponseDto {
    return {
      id: item.id,
      campaignId: item.campaignId,
      productId: item.productId,
      discountPercentage: item.discountPercentage
        ? toMoneyString(item.discountPercentage)
        : null,
      discountAmount: item.discountAmount
        ? toMoneyString(item.discountAmount)
        : null,
      specialPrice: item.specialPrice ? toMoneyString(item.specialPrice) : null,
      product: item.product,
    };
  }
}
