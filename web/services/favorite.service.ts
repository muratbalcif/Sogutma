import { clientApiFetch } from "@/lib/api/client";

export const favoriteService = {
  list: () => clientApiFetch("/favorites"),
  add: (productId: string) =>
    clientApiFetch(`/favorites/${productId}`, { method: "POST" }),
  remove: (productId: string) =>
    clientApiFetch(`/favorites/${productId}`, { method: "DELETE" }),
  check: (productId: string) =>
    clientApiFetch<{ isFavorite: boolean }>(`/favorites/check/${productId}`),
};
