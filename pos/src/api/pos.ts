import { posRequest } from "./http";
import type {
  CreatePosReturnRequest,
  CreatePosSaleRequest,
  PosProductLookup,
  PosRegister,
  PosReturn,
  PosSale,
} from "../types/api";

export function listRegisters(): Promise<PosRegister[]> {
  return posRequest<PosRegister[]>("/pos/registers");
}

export function lookupProducts(
  q: string,
  customerId?: string | null,
): Promise<PosProductLookup[]> {
  const params = new URLSearchParams({ q });
  if (customerId) params.set("customerId", customerId);
  return posRequest<PosProductLookup[]>(`/pos/products/lookup?${params}`);
}

export function getSale(id: string): Promise<PosSale> {
  return posRequest<PosSale>(`/pos/sales/${id}`);
}

export function getSaleByNumber(saleNumber: string): Promise<PosSale> {
  return posRequest<PosSale>(
    `/pos/sales/by-number/${encodeURIComponent(saleNumber.trim())}`,
  );
}

export function createSale(
  body: CreatePosSaleRequest,
  idempotencyKey: string,
): Promise<PosSale> {
  return posRequest<PosSale>("/pos/sales", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function createReturn(
  saleId: string,
  body: CreatePosReturnRequest,
  idempotencyKey: string,
): Promise<PosReturn> {
  return posRequest<PosReturn>(`/pos/sales/${saleId}/returns`, {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
