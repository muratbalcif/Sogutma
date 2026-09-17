import { clientApiFetch } from "@/lib/api/client";

export const addressService = {
  list: () => clientApiFetch("/addresses"),
  create: (body: Record<string, unknown>) =>
    clientApiFetch("/addresses", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    clientApiFetch(`/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    clientApiFetch(`/addresses/${id}`, { method: "DELETE" }),
};
