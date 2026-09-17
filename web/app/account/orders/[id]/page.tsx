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
    payment: {
      status: string;
      method: string;
      amount: string;
    } | null;
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
    shippingAddress?: Record<string, string>;
  };

  let order: Order;
  try {
    order = await serverApiFetch<Order>(`/orders/${id}`);
  } catch {
    notFound();
  }

  const paymentStatusLabel = (status?: string | null) => {
    switch (status) {
      case "PENDING":
        return "Ödeme bekleniyor";
      case "PAID":
        return "Ödeme alındı";
      case "FAILED":
        return "Ödeme doğrulanamadı";
      case "CANCELLED":
        return "Ödeme iptal edildi";
      default:
        return status ?? "—";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
          {order.orderNumber}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge>{order.status}</Badge>
          <Badge>{paymentStatusLabel(order.payment?.status)}</Badge>
          <span className="text-slate-500">
            {new Date(order.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
        {order.payment?.method === "BANK_TRANSFER" &&
        order.payment.status === "PENDING" ? (
          <a
            href={`/account/bank-transfers?orderId=${order.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-accent"
          >
            Havale Bildirimi Yap
          </a>
        ) : null}
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
        <p className="mt-1 text-sm text-slate-600">
          Ödeme: Havale / EFT · {paymentStatusLabel(order.payment?.status)}
        </p>
      </section>
      {order.shippingAddress ? (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h2 className="font-semibold">Teslimat adresi</h2>
          <p className="mt-2">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          <p>{order.shippingAddress.addressLine}</p>
          <p>
            {order.shippingAddress.district}/{order.shippingAddress.city}
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
