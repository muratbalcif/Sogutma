"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { usePermissions } from "@/hooks/use-permissions";
import {
  orderStatusLabel,
  paymentStatusLabel,
} from "@/lib/enum-labels";
import { ordersService, type AdminOrder } from "@/services/admin-api.service";

const ACTION_LABEL: Record<string, string> = {
  CONFIRMED: "Siparişi Onayla",
  PREPARING: "Hazırlamaya Al",
  SHIPPED: "Kargoya Ver",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "İptal Et",
  RETURNED: "İade Başlat",
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canUpdate = can("order.update");

  const [shipOpen, setShipOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => ordersService.getById(id),
    enabled: Boolean(id),
  });

  const order = detailQuery.data;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const statusMutation = useMutation({
    mutationFn: (body: {
      status: string;
      note?: string;
      returnReason?: string;
      adminNote?: string;
    }) => ordersService.updateStatus(id, body),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const shipMutation = useMutation({
    mutationFn: () =>
      ordersService.ship(id, {
        trackingNumber,
        trackingUrl: trackingUrl || undefined,
        note: shipNote || undefined,
      }),
    onSuccess: async () => {
      setShipOpen(false);
      setTrackingNumber("");
      setTrackingUrl("");
      setShipNote("");
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deliverMutation = useMutation({
    mutationFn: () => ordersService.deliver(id, { note: "Teslim edildi" }),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      ordersService.startReturn(id, {
        returnReason: returnReason || undefined,
        adminNote: adminNote || undefined,
      }),
    onSuccess: async () => {
      setReturnOpen(false);
      setReturnReason("");
      setAdminNote("");
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const actions = useMemo(() => {
    if (!order) return [];
    return order.allowedTransitions;
  }, [order]);

  const onAction = (toStatus: string) => {
    if (toStatus === "SHIPPED") {
      setShipOpen(true);
      return;
    }
    if (toStatus === "DELIVERED") {
      deliverMutation.mutate();
      return;
    }
    if (toStatus === "RETURNED") {
      setReturnOpen(true);
      return;
    }
    statusMutation.mutate({ status: toStatus });
  };

  return (
    <ModulePage permission="order.read">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-slate-800"
              onClick={() => router.push("/orders")}
            >
              ← Siparişler
            </button>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
              {order?.orderNumber ?? "Sipariş"}
            </h1>
          </div>
        </div>

        {detailQuery.isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : detailQuery.isError || !order ? (
          <p className="text-sm text-red-600">Sipariş yüklenemedi.</p>
        ) : (
          <>
            <HeaderCard order={order} />

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {canUpdate ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={
                      statusMutation.isPending ||
                      shipMutation.isPending ||
                      deliverMutation.isPending ||
                      returnMutation.isPending
                    }
                    onClick={() => onAction(status)}
                  >
                    {ACTION_LABEL[status] ?? status}
                  </button>
                ))}
              </div>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">Kargo Bilgileri</h2>
              {order.shipping ? (
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Kargo firması</dt>
                    <dd>{order.shipping.provider === "MANUAL" ? "Manuel" : order.shipping.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Takip numarası</dt>
                    <dd className="font-mono">{order.shipping.trackingNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Takip URL</dt>
                    <dd>
                      {order.shipping.trackingUrl ? (
                        <a
                          href={order.shipping.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-700 underline"
                        >
                          {order.shipping.trackingUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Kargoya verilme</dt>
                    <dd>
                      {order.shipping.shippedAt
                        ? new Date(order.shipping.shippedAt).toLocaleString("tr-TR")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Teslim</dt>
                    <dd>
                      {order.shipping.deliveredAt
                        ? new Date(order.shipping.deliveredAt).toLocaleString("tr-TR")
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Henüz kargo kaydı yok.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">Ürünler</h2>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {item.productName} × {item.quantity}
                      <span className="ml-2 font-mono text-xs text-slate-400">{item.sku}</span>
                    </span>
                    <span>
                      {item.totalAmount} {order.currency}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-slate-100 pt-3 font-semibold">
                Toplam: {order.totalAmount} {order.currency}
              </p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">Durum geçmişi</h2>
              <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4 text-sm">
                {order.statusHistory.map((entry) => (
                  <li key={entry.id}>
                    <p className="font-medium">
                      {orderStatusLabel(entry.toStatus)}
                    </p>
                    <p className="text-slate-500">
                      {new Date(entry.createdAt).toLocaleString("tr-TR")}
                      {entry.changedBy ? (
                        <>
                          {" · "}
                          <span className="font-mono text-xs">{entry.changedBy}</span>
                        </>
                      ) : (
                        " · sistem"
                      )}
                    </p>
                    {entry.note ? <p className="text-slate-600">{entry.note}</p> : null}
                  </li>
                ))}
              </ol>
            </section>

            {order.orderReturn ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <h2 className="font-semibold text-slate-900">İade kaydı</h2>
                <p className="mt-2">Sebep: {order.orderReturn.returnReason ?? "—"}</p>
                <p>Admin notu: {order.orderReturn.adminNote ?? "—"}</p>
              </section>
            ) : null}
          </>
        )}

        {shipOpen ? (
          <Modal title="Kargoya Ver" onClose={() => setShipOpen(false)}>
            <label className="block text-sm">
              <span className="text-slate-600">Kargo firması</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value="Manuel"
                disabled
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Takip numarası *</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Takip URL</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Not</span>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                rows={2}
                value={shipNote}
                onChange={(e) => setShipNote(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setShipOpen(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={!trackingNumber.trim() || shipMutation.isPending}
                onClick={() => shipMutation.mutate()}
              >
                Kaydet
              </button>
            </div>
          </Modal>
        ) : null}

        {returnOpen ? (
          <Modal title="İade Başlat" onClose={() => setReturnOpen(false)}>
            <label className="block text-sm">
              <span className="text-slate-600">İade sebebi</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Admin notu</span>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                rows={2}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setReturnOpen(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
              >
                İade Kaydı Oluştur
              </button>
            </div>
          </Modal>
        ) : null}
      </div>
    </ModulePage>
  );
}

function HeaderCard({ order }: { order: AdminOrder }) {
  const customer = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`.trim() ||
      order.customer.email
    : "—";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-slate-500">Sipariş No</p>
          <p className="font-mono font-semibold">{order.orderNumber}</p>
        </div>
        <div>
          <p className="text-slate-500">Tarih</p>
          <p>{new Date(order.createdAt).toLocaleString("tr-TR")}</p>
        </div>
        <div>
          <p className="text-slate-500">Müşteri</p>
          <p>{customer}</p>
          {order.customer?.email ? (
            <p className="text-slate-500">{order.customer.email}</p>
          ) : null}
          {order.customer?.phone ? (
            <p className="text-slate-500">{order.customer.phone}</p>
          ) : null}
        </div>
        <div>
          <p className="text-slate-500">Ödeme durumu</p>
          <p className="font-medium">
            {order.payment
              ? paymentStatusLabel(order.payment.status)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Sipariş durumu</p>
          <p className="font-medium">
            {orderStatusLabel(order.status)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Tutar</p>
          <p className="font-semibold">
            {order.totalAmount} {order.currency}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Detay ID: <Link href={`/orders/${order.id}`}>{order.id}</Link>
      </p>
    </section>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button type="button" className="text-slate-500" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
