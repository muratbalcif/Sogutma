export type CreateShipmentInput = {
  orderId: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  note?: string | null;
};

export type ShipmentTracking = {
  provider: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

/**
 * Future carrier adapters (Aras, Yurtiçi, MNG, HepsiJET) implement this interface.
 * v1 uses ManualShippingProvider only — no HTTP carrier APIs.
 */
export interface ShippingProvider {
  readonly code: string;
  createShipment(input: CreateShipmentInput): Promise<ShipmentTracking>;
  cancelShipment(orderId?: string): Promise<void>;
  getTracking(orderId?: string): Promise<ShipmentTracking | null>;
}

export const SHIPPING_PROVIDERS = Symbol('SHIPPING_PROVIDERS');
