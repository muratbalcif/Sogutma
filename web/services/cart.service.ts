import { clientApiFetch } from "@/lib/api/client";
import type { CartResponse } from "@/types/api";

export const cartService = {
  get: () => clientApiFetch<CartResponse>("/cart"),
  addItem: (productId: string, quantity: number) =>
    clientApiFetch<CartResponse>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  updateItem: (productId: string, quantity: number) =>
    clientApiFetch<CartResponse>(`/cart/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (productId: string) =>
    clientApiFetch<CartResponse>(`/cart/items/${productId}`, {
      method: "DELETE",
    }),
  clear: () => clientApiFetch<CartResponse>("/cart", { method: "DELETE" }),
  validate: () =>
    clientApiFetch<{ valid: boolean; issues?: unknown[] }>("/cart/validate", {
      method: "POST",
    }),
};
