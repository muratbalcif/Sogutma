import { Injectable } from '@nestjs/common';
import {
  CreateShipmentInput,
  ShipmentTracking,
  ShippingProvider,
} from './shipping-provider.interface';

/**
 * Manual carrier: admin enters tracking; no external HTTP calls.
 */
@Injectable()
export class ManualShippingProvider implements ShippingProvider {
  readonly code = 'MANUAL';

  createShipment(input: CreateShipmentInput): Promise<ShipmentTracking> {
    return Promise.resolve({
      provider: this.code,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl ?? null,
      status: 'SHIPPED',
      shippedAt: new Date(),
      deliveredAt: null,
    });
  }

  cancelShipment(): Promise<void> {
    return Promise.resolve();
  }

  getTracking(): Promise<ShipmentTracking | null> {
    return Promise.resolve(null);
  }
}
