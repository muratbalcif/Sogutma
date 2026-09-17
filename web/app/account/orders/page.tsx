import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { serverApiFetch } from "@/lib/api/server";
import type { Paginated } from "@/types/api";

export default async function OrdersPage() {
  const orders = await serverApiFetch<
    Paginated<{
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: string;
      currency: string;
      createdAt: string;
    }>
  >("/orders?page=1&limit=50").catch(() => null);

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
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl text-navy">
        Siparişlerim
      </h1>
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
