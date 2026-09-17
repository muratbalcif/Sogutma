"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clientApiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";
import type { CartSummary } from "@/lib/cart";
import type { ProductDetail } from "@/types/api";

type CartWithItems = CartSummary & {
  items: Array<{ quantity: number; product: { id: string } }>;
};

export function ProductActions({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addToCart() {
    setLoading(true);
    setMessage(null);
    try {
      const cart = await clientApiFetch<CartWithItems>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      queryClient.setQueryData(["cart"], cart);
      const qty =
        cart.items.find((item) => item.product?.id === product.id)?.quantity ??
        quantity;
      setMessage(`Sepete eklendi · Adet: ${qty}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/login?next=/products/${product.slug}`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function addFavorite() {
    try {
      await clientApiFetch(`/favorites/${product.id}`, { method: "POST" });
      setMessage("Favorilere eklendi");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/login?next=/products/${product.slug}`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Favori eklenemedi");
    }
  }

  async function createAlert() {
    try {
      await clientApiFetch(`/products/${product.id}/alerts`, { method: "POST" });
      setMessage("Stok bildirimi oluşturuldu");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/login?next=/products/${product.slug}`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Bildirim oluşturulamadı");
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3">
        <label htmlFor="qty" className="text-sm">
          Adet
        </label>
        <input
          id="qty"
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value) || 1)}
          className="w-20 rounded border px-2 py-1.5 text-sm"
        />
      </div>
      {product.stock?.available ? (
        <Button type="button" disabled={loading} onClick={() => void addToCart()}>
          Sepete ekle
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={() => void createAlert()}>
          Stoğa gelince haber ver
        </Button>
      )}
      <Button type="button" variant="secondary" onClick={() => void addFavorite()}>
        Favoriye ekle
      </Button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
