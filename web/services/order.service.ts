import { clientApiFetch } from "@/lib/api/client";

export const orderService = {
  list: () => clientApiFetch("/orders"),
  get: (id: string) => clientApiFetch(`/orders/${encodeURIComponent(id)}`),
  create: (body: Record<string, unknown>) =>
    clientApiFetch("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancel: (id: string) =>
    clientApiFetch(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    }),
  validateCheckout: (body: Record<string, unknown>) =>
    clientApiFetch("/checkout/validate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
