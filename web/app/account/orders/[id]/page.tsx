import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/account/cancel-order-button";
import { Badge } from "@/components/ui/badge";
import { serverApiFetch } from "@/lib/api/server";
import {
  orderStatusLabel,
  orderStatusTone,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  shippingProviderLabel,
  shippingStatusLabel,
} from "@/lib/order-labels";

type Props = { params: Promise<{ id: string }> };

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  canCancel: boolean;
  allowedTransitions: string[];
  payment: {
    status: string;
    method: string;
    amount: string;
    approvedTotal?: string;
    remainingAmount?: string;
  } | null;
  shipping: {
    provider: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
  }>;
  statusHistory: Array<{
    id: string;
    toStatus: string;
    createdAt: string;
    note: string | null;
  }>;
  shippingAddress?: Record<string, string>;
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={orderStatusTone(order.status)}>
            {orderStatusLabel(order.status)}
          </Badge>
          <Badge tone={paymentStatusTone(order.payment?.status)}>
            {paymentStatusLabel(order.payment?.status)}
          </Badge>
          <span className="text-slate-500">
            {new Date(order.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
        {order.payment?.method === "BANK_TRANSFER" &&
        (order.payment.status === "PENDING" ||
          order.payment.status === "PARTIALLY_PAID") ? (
          <a
            href={`/account/bank-transfers?orderId=${order.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-accent"
          >
            Havale / EFT ile Öde
            {order.payment.remainingAmount
              ? ` · Kalan ${order.payment.remainingAmount} ${order.currency}`
              : ""}
          </a>
        ) : null}
        {order.canCancel ? (
          <div className="mt-4">
            <CancelOrderButton orderId={order.id} />
          </div>
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
          Ödeme: {paymentMethodLabel(order.payment?.method)} ·{" "}
          {paymentStatusLabel(order.payment?.status)}
          {order.payment?.approvedTotal != null &&
          order.payment.status !== "PENDING"
            ? ` · Ödenen ${order.payment.approvedTotal} ${order.currency}`
            : ""}
          {order.payment?.remainingAmount != null &&
          (order.payment.status === "PENDING" ||
            order.payment.status === "PARTIALLY_PAID")
            ? ` · Kalan ${order.payment.remainingAmount} ${order.currency}`
            : ""}
        </p>
      </section>

      {order.shipping ? (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h2 className="font-semibold">Kargo</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-500">Firma:</dt>
              <dd>{shippingProviderLabel(order.shipping.provider)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-500">Durum:</dt>
              <dd>{shippingStatusLabel(order.shipping.status)}</dd>
            </div>
            {order.shipping.trackingNumber ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500">Takip no:</dt>
                <dd className="font-medium">{order.shipping.trackingNumber}</dd>
              </div>
            ) : null}
            {order.shipping.shippedAt ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500">Kargoya verildi:</dt>
                <dd>
                  {new Date(order.shipping.shippedAt).toLocaleString("tr-TR")}
                </dd>
              </div>
            ) : null}
            {order.shipping.deliveredAt ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500">Teslim:</dt>
                <dd>
                  {new Date(order.shipping.deliveredAt).toLocaleString(
                    "tr-TR",
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
          {order.shipping.trackingUrl ? (
            <a
              href={order.shipping.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              Kargoyu Takip Et
            </a>
          ) : null}
        </section>
      ) : null}

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

      {order.statusHistory.length > 0 ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Sipariş geçmişi</h2>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4 text-sm">
            {order.statusHistory.map((event) => (
              <li key={event.id}>
                <p className="font-medium">
                  {orderStatusLabel(event.toStatus)}
                </p>
                <p className="text-slate-500">
                  {new Date(event.createdAt).toLocaleString("tr-TR")}
                </p>
                {event.note ? (
                  <p className="mt-0.5 text-slate-600">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
