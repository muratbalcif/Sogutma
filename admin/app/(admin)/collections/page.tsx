"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { accountingService } from "@/services/admin-api.service";

export default function CollectionsPage() {
  const [customerId, setCustomerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const summary = useQuery({
    queryKey: ["collections-summary"],
    queryFn: () => accountingService.collectionsSummary(),
  });

  const list = useQuery({
    queryKey: ["collections", customerId, dateFrom, dateTo],
    queryFn: () =>
      accountingService.collections(1, 50, {
        customerId: customerId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  return (
    <ModulePage permission="accounting.read">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Tahsilatlar
        </h1>
        <p className="text-sm text-slate-500">
          Onaylanmış havale bildirimlerinden oluşan gerçek tahsilatlar.
        </p>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 text-sm">
            <p className="text-slate-500">Bugünkü tahsilat</p>
            <p className="text-xl font-semibold">
              {summary.data?.todayCollections ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            <p className="text-slate-500">Bu ay tahsilat</p>
            <p className="text-xl font-semibold">
              {summary.data?.monthCollections ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            <p className="text-slate-500">Bekleyen havale</p>
            <p className="text-xl font-semibold">
              {summary.data?.pendingTransfers ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            <p className="text-slate-500">Reddedilen</p>
            <p className="text-xl font-semibold">
              {summary.data?.rejectedTransfers ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="Müşteri UUID"
            className="rounded border px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>

        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Sipariş</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Banka</th>
                <th className="px-3 py-2">Havale</th>
                <th className="px-3 py-2">Onay</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.items ?? []).map((row) => {
                const r = row as {
                  id: string;
                  customer?: { name: string };
                  order?: { orderNumber: string };
                  amount: string;
                  bank: string | null;
                  transferDate: string;
                  approvedDate: string | null;
                };
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.customer?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.order?.orderNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.amount}</td>
                    <td className="px-3 py-2">{r.bank ?? "—"}</td>
                    <td className="px-3 py-2">
                      {new Date(r.transferDate).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-3 py-2">
                      {r.approvedDate
                        ? new Date(r.approvedDate).toLocaleString("tr-TR")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ModulePage>
  );
}
