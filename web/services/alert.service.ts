import { clientApiFetch } from "@/lib/api/client";

export const alertService = {
  list: () => clientApiFetch("/product-alerts"),
  create: (productId: string) =>
    clientApiFetch(`/products/${productId}/alerts`, { method: "POST" }),
  remove: (productId: string) =>
    clientApiFetch(`/products/${productId}/alerts`, { method: "DELETE" }),
};
