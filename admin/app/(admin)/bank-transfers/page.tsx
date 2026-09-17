"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import { paymentsService } from "@/services/admin-api.service";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export default function BankTransfersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("PENDING");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-bank-transfers", status, search],
    queryFn: () =>
      paymentsService.listBankTransfers(1, 50, {
        status: status === "ALL" ? undefined : status,
        search: search || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-bank-transfer", selectedId],
    queryFn: () => paymentsService.getBankTransfer(selectedId!),
    enabled: Boolean(selectedId),
  });

  const approve = useMutation({
    mutationFn: () =>
      paymentsService.approveBankTransfer(selectedId!, { adminNote }),
    onSuccess: async () => {
      setAdminNote("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-bank-transfers"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin-bank-transfer", selectedId],
      });
    },
    onError: (err: Error) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err.message || "Onay işlemi başarısız",
      );
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      paymentsService.rejectBankTransfer(selectedId!, {
        rejectionReason: rejectReason,
        adminNote,
      }),
    onSuccess: async () => {
      setRejectReason("");
      setAdminNote("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-bank-transfers"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin-bank-transfer", selectedId],
      });
    },
    onError: (err: Error) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err.message || "Red işlemi başarısız",
      );
    },
  });

  const items = listQuery.data?.items ?? [];
  const detail = detailQuery.data;
  const canApprove = can("bank_transfer.approve");
  const canReject = can("bank_transfer.reject");

  const statusLabel = useMemo(
    () => ({
      PENDING: "Bekliyor",
      APPROVED: "Onaylandı",
      REJECTED: "Reddedildi",
    }),
    [],
  );

  return (
    <ModulePage permission="bank_transfer.read">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
              Havale Bildirimleri
            </h1>
            <p className="text-sm text-slate-600">
              Finans → bekleyen havaleleri inceleyin, onaylayın veya reddedin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Sipariş / müşteri / referans"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof STATUS_FILTERS)[number])
              }
            >
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Sipariş No</th>
                  <th className="px-4 py-3 font-medium">Müşteri</th>
                  <th className="px-4 py-3 font-medium">Tutar</th>
                  <th className="px-4 py-3 font-medium">Sipariş Tutarı</th>
                  <th className="px-4 py-3 font-medium">Banka</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
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
                      setActionError(null);
                      setSelectedId(row.id);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.orderNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">{row.customerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.amount}
                      {row.amountMismatch ? (
                        <span className="ml-1 text-xs text-amber-700">≠</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.orderTotal ?? "—"}</td>
                    <td className="px-4 py-3">{row.bankName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {new Date(row.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      {statusLabel[row.status as keyof typeof statusLabel] ??
                        row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Toplam: {listQuery.data?.meta.total ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedId ? (
              <p className="text-sm text-slate-500">Detay için bir satır seçin.</p>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-slate-500">Yükleniyor…</p>
            ) : detail ? (
              <div className="space-y-3 text-sm">
                <h2 className="text-lg font-semibold">Havale detayı</h2>
                <p>
                  <strong>Sipariş:</strong> {detail.orderNumber}
                </p>
                <p>
                  <strong>Müşteri:</strong> {detail.customerName}
                </p>
                <p>
                  <strong>Sipariş tutarı:</strong> {detail.orderTotal}
                </p>
                <p>
                  <strong>Bildirilen tutar:</strong> {detail.amount}
                  {detail.amountMismatch ? " (uyuşmazlık)" : ""}
                </p>
                <p>
                  <strong>Banka:</strong> {detail.bankName ?? "—"}
                </p>
                <p>
                  <strong>Havale tarihi:</strong>{" "}
                  {new Date(detail.transferDate).toLocaleDateString("tr-TR")}
                </p>
                <p>
                  <strong>Açıklama:</strong> {detail.note ?? "—"}
                </p>
                <p>
                  <strong>Referans:</strong> {detail.referenceNumber ?? "—"}
                </p>
                <p>
                  <strong>Durum:</strong> {detail.status}
                </p>
                <textarea
                  className="w-full rounded-md border border-slate-300 p-2"
                  rows={3}
                  placeholder="Admin notu"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
                {detail.status === "PENDING" ? (
                  <div className="space-y-2">
                    {canApprove ? (
                      <button
                        type="button"
                        className="w-full rounded-md bg-emerald-700 px-3 py-2 text-white"
                        onClick={() => approve.mutate()}
                        disabled={approve.isPending}
                      >
                        ONAYLA
                      </button>
                    ) : null}
                    {canReject ? (
                      <>
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                          placeholder="Red nedeni (zorunlu)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <button
                          type="button"
                          className="w-full rounded-md bg-red-700 px-3 py-2 text-white disabled:opacity-50"
                          onClick={() => reject.mutate()}
                          disabled={reject.isPending || rejectReason.trim().length < 2}
                        >
                          REDDET
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {actionError ? (
                  <p className="text-red-600">{actionError}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-red-600">Detay bulunamadı.</p>
            )}
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
