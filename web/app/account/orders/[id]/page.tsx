import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { serverApiFetch } from "@/lib/api/server";

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  type Order = {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    currency: string;
    createdAt: string;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: string;
      totalAmount: string;
    }>;
    statusHistory?: Array<{
      id: string;
      toStatus: string;
      createdAt: string;
      note: string | null;
    }>;
    shippingAddressSnapshot?: Record<string, string>;
  };

  let order: Order;
  try {
    order = await serverApiFetch<Order>(`/orders/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
          {order.orderNumber}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Badge>{order.status}</Badge>
          <span className="text-slate-500">
            {new Date(order.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
      </div>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Ürünler</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>
                {item.totalAmount} {order.currency}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t pt-3 font-semibold">
          Toplam: {order.totalAmount} {order.currency}
        </p>
      </section>
      {order.shippingAddressSnapshot ? (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h2 className="font-semibold">Teslimat adresi</h2>
          <p className="mt-2">
            {order.shippingAddressSnapshot.firstName}{" "}
            {order.shippingAddressSnapshot.lastName}
          </p>
          <p>{order.shippingAddressSnapshot.addressLine}</p>
          <p>
            {order.shippingAddressSnapshot.district}/
            {order.shippingAddressSnapshot.city}
          </p>
        </section>
      ) : null}
      {order.statusHistory && order.statusHistory.length > 0 ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Sipariş geçmişi</h2>
          <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4 text-sm">
            {order.statusHistory.map((event) => (
              <li key={event.id}>
                <p className="font-medium">{event.toStatus}</p>
                <p className="text-slate-500">
                  {new Date(event.createdAt).toLocaleString("tr-TR")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
