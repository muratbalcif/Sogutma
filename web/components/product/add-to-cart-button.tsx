"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clientApiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";
import type { CartSummary } from "@/lib/cart";

type Props = {
  productId: string;
  productSlug: string;
  available?: boolean;
  className?: string;
};

type CartWithItems = CartSummary & {
  items: Array<{ quantity: number; product: { id: string } }>;
};

export function AddToCartButton({
  productId,
  productSlug,
  available = true,
  className,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      try {
        return await clientApiFetch<CartWithItems>("/cart");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 15_000,
  });

  const inCartQty =
    cartQuery.data?.items.find((item) => item.product.id === productId)
      ?.quantity ?? 0;

  async function addToCart() {
    if (!available) return;
    setLoading(true);
    setMessage(null);
    try {
      const cart = await clientApiFetch<CartWithItems>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      queryClient.setQueryData(["cart"], cart);
      const qty =
        cart.items.find((item) => item.product.id === productId)?.quantity ??
        inCartQty + 1;
      setMessage(`Sepete eklendi · Adet: ${qty}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/login?next=/products/${productSlug}`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!available || loading}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void addToCart();
        }}
      >
        {!available
          ? "Stokta yok"
          : loading
            ? "Ekleniyor…"
            : inCartQty > 0
              ? `Sepete ekle · ${inCartQty}`
              : "Sepete ekle"}
      </Button>
      {message ? <p className="mt-1 text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
