"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import { paymentsService } from "@/services/admin-api.service";

const STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
] as const;

const METHOD_FILTERS = [
  "ALL",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "CASH_ON_DELIVERY",
] as const;

export default function PaymentsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [method, setMethod] = useState<(typeof METHOD_FILTERS)[number]>("ALL");
  const [orderNumber, setOrderNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-payments", page, status, method, orderNumber, from, to],
    queryFn: () =>
      paymentsService.list(page, 50, {
        status: status === "ALL" ? undefined : status,
        method: method === "ALL" ? undefined : method,
        orderNumber: orderNumber.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-payment", selectedId],
    queryFn: () => paymentsService.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const refundMutation = useMutation({
    mutationFn: (id: string) => paymentsService.refund(id),
    onSuccess: async () => {
      setRefundError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin-payment", selectedId],
      });
    },
    onError: (err: Error) => {
      setRefundError(
        err instanceof ApiError
          ? err.message
          : err.message || "İade işlemi başarısız",
      );
    },
  });

  const items = listQuery.data?.items ?? [];
  const detail = detailQuery.data;
  const canRefund = can("payment.refund");

  return (
    <ModulePage permission="payment.read">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
              Ödemeler
            </h1>
            <p className="text-sm text-slate-600">
              Durum / yöntem / sipariş no / tarih filtreleri. İade için{" "}
              <code className="text-xs">payment.refund</code> gerekir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Sipariş no"
              value={orderNumber}
              onChange={(e) => {
                setPage(1);
                setOrderNumber(e.target.value);
              }}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as (typeof STATUS_FILTERS)[number]);
              }}
            >
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "Tüm durumlar" : value}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={method}
              onChange={(e) => {
                setPage(1);
                setMethod(e.target.value as (typeof METHOD_FILTERS)[number]);
              }}
            >
              {METHOD_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "Tüm yöntemler" : value}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              aria-label="Başlangıç tarihi"
            />
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              aria-label="Bitiş tarihi"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {listQuery.isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Yükleniyor…</p>
            ) : listQuery.error ? (
              <p className="px-4 py-6 text-sm text-red-600">
                Ödeme listesi alınamadı.
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">
                Filtreye uygun ödeme yok.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">Yöntem</th>
                    <th className="px-4 py-3 font-medium">Tutar</th>
                    <th className="px-4 py-3 font-medium">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        selectedId === row.id ? "bg-cyan-50" : ""
                      }`}
                      onClick={() => {
                        setRefundError(null);
                        setSelectedId(row.id);
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">{row.method}</td>
                      <td className="px-4 py-3">
                        {row.amount} {row.currency}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(row.createdAt).toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              <span>Toplam: {listQuery.data?.meta.total ?? 0}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={(listQuery.data?.meta.totalPages ?? 1) <= page}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedId ? (
              <p className="text-sm text-slate-500">
                Detay için listeden bir ödeme seçin.
              </p>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-slate-500">Detay yükleniyor…</p>
            ) : detailQuery.error || !detail ? (
              <p className="text-sm text-red-600">Ödeme detayı alınamadı.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <h2 className="font-semibold text-slate-900">Ödeme detayı</h2>
                <dl className="grid gap-2">
                  <div>
                    <dt className="text-xs text-slate-500">ID</dt>
                    <dd className="font-mono text-xs">{detail.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Sipariş</dt>
                    <dd>
                      <Link
                        href={`/orders/${detail.orderId}`}
                        className="text-cyan-800 underline"
                      >
                        {detail.orderId}
                      </Link>
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <dt className="text-xs text-slate-500">Durum</dt>
                      <dd>{detail.status}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Yöntem</dt>
                      <dd>{detail.method}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Tutar</dt>
                    <dd>
                      {detail.amount} {detail.currency}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Sağlayıcı</dt>
                    <dd>{detail.provider ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Provider payment ID</dt>
                    <dd className="font-mono text-xs">
                      {detail.providerPaymentId ?? "—"}
                    </dd>
                  </div>
                  {detail.failureMessage ? (
                    <div>
                      <dt className="text-xs text-slate-500">Hata</dt>
                      <dd className="text-red-700">
                        {detail.failureCode ? `${detail.failureCode}: ` : ""}
                        {detail.failureMessage}
                      </dd>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <dt className="text-xs text-slate-500">Ödeme</dt>
                      <dd>
                        {detail.paidAt
                          ? new Date(detail.paidAt).toLocaleString("tr-TR")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Oluşturma</dt>
                      <dd>
                        {new Date(detail.createdAt).toLocaleString("tr-TR")}
                      </dd>
                    </div>
                  </div>
                </dl>

                {refundError ? (
                  <p className="text-sm text-red-600">{refundError}</p>
                ) : null}

                {canRefund && detail.status === "PAID" ? (
                  <button
                    type="button"
                    disabled={refundMutation.isPending}
                    className="rounded-md bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Bu ödemeyi iade etmek istediğinize emin misiniz?\n${detail.amount} ${detail.currency}`,
                        )
                      ) {
                        refundMutation.mutate(detail.id);
                      }
                    }}
                  >
                    {refundMutation.isPending ? "İade ediliyor…" : "İade et"}
                  </button>
                ) : null}
                {!canRefund && detail.status === "PAID" ? (
                  <p className="text-xs text-slate-500">
                    İade için payment.refund yetkisi gerekli.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
