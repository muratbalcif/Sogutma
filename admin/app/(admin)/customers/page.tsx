"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { apiDownloadText } from "@/lib/api-client";
import { customersAdminService } from "@/services/admin-api.service";

const FILTERS = [
  { value: "", label: "Tümü" },
  { value: "INDIVIDUAL", label: "Bireysel" },
  { value: "CORPORATE", label: "Kurumsal" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Pasif" },
  { value: "DEBTOR", label: "Borçlu" },
  { value: "CREDITOR", label: "Alacaklı" },
] as const;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-customers", page, search, filter],
    queryFn: () =>
      customersAdminService.list(page, 20, {
        search: search || undefined,
        filter: filter || undefined,
      }),
  });

  return (
    <ModulePage permission="customer.read">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
              Müşteriler
            </h1>
            <p className="text-sm text-slate-500">
              Server-side arama ve filtre. Bakiye ledger aggregate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void apiDownloadText(
                customersAdminService.exportUrl({
                  search: search || undefined,
                  filter: filter || undefined,
                }),
                "customers.csv",
              );
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            CSV Export
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="İsim, e-posta, telefon, firma, vergi no…"
            className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {FILTERS.map((f) => (
              <option key={f.value || "all"} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Müşteri listesi alınamadı.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium">E-posta</th>
                  <th className="px-3 py-2 font-medium">Telefon</th>
                  <th className="px-3 py-2 font-medium">Tip</th>
                  <th className="px-3 py-2 font-medium">Firma</th>
                  <th className="px-3 py-2 font-medium">Bakiye</th>
                  <th className="px-3 py-2 font-medium">Sipariş</th>
                  <th className="px-3 py-2 font-medium">Toplam</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-cyan-800 hover:underline"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{c.email}</td>
                    <td className="px-3 py-2">{c.phone ?? "—"}</td>
                    <td className="px-3 py-2">{c.userType}</td>
                    <td className="px-3 py-2">{c.companyName ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{c.balance}</td>
                    <td className="px-3 py-2">{c.orderCount}</td>
                    <td className="px-3 py-2">{c.totalSpent}</td>
                    <td className="px-3 py-2">{c.status}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span>Toplam: {data?.meta.total ?? 0}</span>
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
                  disabled={(data?.meta.totalPages ?? 1) <= page}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModulePage>
  );
}
