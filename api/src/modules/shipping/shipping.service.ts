import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  ShippingProviderCode,
  ShippingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ManualShippingProvider } from './manual-shipping.provider';
import {
  SHIPPING_PROVIDERS,
  ShippingProvider,
} from './shipping-provider.interface';

const ALLOWED_TRACKING_URL_HOSTS = new Set([
  'aras.com',
  'www.aras.com',
  'kargotakip.araskargo.com.tr',
  'www.yurticikargo.com',
  'yurticikargo.com',
  'www.mngkargo.com.tr',
  'mngkargo.com.tr',
  'www.suratkargo.com.tr',
  'www.hepsijet.com',
  'hepsijet.com',
]);

@Injectable()
export class ShippingService {
  private readonly providers: Map<string, ShippingProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly manualProvider: ManualShippingProvider,
    @Inject(SHIPPING_PROVIDERS)
    providerList: ShippingProvider[],
  ) {
    this.providers = new Map(providerList.map((p) => [p.code, p]));
  }

  sanitizeTrackingUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Invalid tracking URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Tracking URL must be http(s)');
    }
    // Allow any https URL in MANUAL mode but reject javascript/data schemes (already blocked).
    // Prefer known hosts; still accept other https for custom carriers with warning-free pass.
    if (
      parsed.protocol === 'http:' &&
      !ALLOWED_TRACKING_URL_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      throw new BadRequestException('Tracking URL must use https');
    }
    return parsed.toString();
  }

  async upsertManualShipmentInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      trackingNumber: string;
      trackingUrl?: string | null;
      note?: string | null;
    },
  ) {
    const trackingNumber = input.trackingNumber?.trim();
    if (!trackingNumber) {
      throw new BadRequestException('Tracking number is required');
    }
    const trackingUrl = this.sanitizeTrackingUrl(input.trackingUrl);
    const providerResult = await this.manualProvider.createShipment({
      orderId: input.orderId,
      trackingNumber,
      trackingUrl,
      note: input.note,
    });

    return tx.shipping.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        provider: ShippingProviderCode.MANUAL,
        trackingNumber,
        trackingUrl,
        status: ShippingStatus.SHIPPED,
        shippedAt: providerResult.shippedAt ?? new Date(),
        note: input.note ?? null,
      },
      update: {
        provider: ShippingProviderCode.MANUAL,
        trackingNumber,
        trackingUrl,
        status: ShippingStatus.SHIPPED,
        shippedAt: new Date(),
        note: input.note ?? null,
      },
    });
  }

  async getByOrderId(orderId: string) {
    return this.prisma.shipping.findUnique({ where: { orderId } });
  }

  async requireOwnedByUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Shipping not found');
    }
    return this.getByOrderId(orderId);
  }

  resolveProvider(code: string): ShippingProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new BadRequestException(`Unknown shipping provider: ${code}`);
    }
    return provider;
  }

  /** Map order status → suggested shipping status (not forced equality). */
  suggestedShippingStatus(orderStatus: OrderStatus): ShippingStatus | null {
    switch (orderStatus) {
      case OrderStatus.SHIPPED:
        return ShippingStatus.SHIPPED;
      case OrderStatus.DELIVERED:
        return ShippingStatus.DELIVERED;
      case OrderStatus.RETURNED:
        return ShippingStatus.RETURNED;
      case OrderStatus.CANCELLED:
        return ShippingStatus.CANCELLED;
      default:
        return null;
    }
  }
}
