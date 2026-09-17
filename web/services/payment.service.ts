import { clientApiFetch } from "@/lib/api/client";

export const paymentService = {
  getForOrder: (orderId: string) =>
    clientApiFetch(`/orders/${orderId}/payment`),
  createForOrder: (orderId: string, body: Record<string, unknown>) =>
    clientApiFetch(`/orders/${orderId}/payment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listBankTransfers: () => clientApiFetch("/bank-transfers"),
  createBankTransfer: (orderId: string, body: Record<string, unknown>) =>
    clientApiFetch(`/orders/${orderId}/bank-transfer`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getBankTransfer: (orderId: string) =>
    clientApiFetch(`/orders/${orderId}/bank-transfer`),
};
