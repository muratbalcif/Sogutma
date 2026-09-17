"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api/base";
import { clientApiFetch } from "@/lib/api/client";
import type { Paginated } from "@/types/api";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
};

export default function OrdersPage() {
  const query = useQuery({
    queryKey: ["account-orders"],
    queryFn: () =>
      clientApiFetch<Paginated<OrderRow>>("/orders?page=1&limit=50"),
  });

  if (query.isLoading) {
    return <p className="text-sm text-slate-600">Siparişler yükleniyor…</p>;
  }

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Siparişler alınamadı.";
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
          Siparişlerim
        </h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-900">Siparişler yüklenemedi</p>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? "Yenileniyor…" : "Tekrar dene"}
          </Button>
        </div>
      </div>
    );
  }

  const orders = query.data;
  if (!orders || orders.items.length === 0) {
    return (
      <EmptyState
        title="Siparişiniz bulunmuyor"
        actionHref="/products"
        actionLabel="Alışverişe başla"
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
          Siparişlerim
        </h1>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? "Yenileniyor…" : "Yenile"}
        </Button>
      </div>
      <div className="space-y-2">
        {orders.items.map((order) => (
          <Link
            key={order.id}
            href={`/account/orders/${order.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 text-sm"
          >
            <div>
              <p className="font-semibold">{order.orderNumber}</p>
              <p className="text-slate-500">
                {new Date(order.createdAt).toLocaleString("tr-TR")}
              </p>
            </div>
            <Badge>{order.status}</Badge>
            <p className="font-medium">
              {order.totalAmount} {order.currency}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
