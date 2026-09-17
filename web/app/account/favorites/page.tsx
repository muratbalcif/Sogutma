"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clientApiFetch } from "@/lib/api/client";

type Favorite = {
  productId: string;
  product: { id: string; name: string; slug: string; sku: string };
};

export default function FavoritesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["favorites"],
    queryFn: () => clientApiFetch<Favorite[]>("/favorites"),
  });

  const remove = useMutation({
    mutationFn: (productId: string) =>
      clientApiFetch(`/favorites/${productId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const addToCart = useMutation({
    mutationFn: (productId: string) =>
      clientApiFetch("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 }),
      }),
  });

  if (query.isLoading) return <p>Yükleniyor…</p>;
  if (!query.data?.length) {
    return <EmptyState title="Favoriniz yok" actionHref="/products" actionLabel="Ürünlere git" />;
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl text-navy">
        Favorilerim
      </h1>
      <ul className="space-y-2">
        {query.data.map((item) => (
          <li
            key={item.productId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-3 text-sm"
          >
            <Link href={`/products/${item.product.slug}`} className="font-medium">
              {item.product.name}
            </Link>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => addToCart.mutate(item.productId)}
              >
                Sepete ekle
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate(item.productId)}
              >
                Çıkar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
