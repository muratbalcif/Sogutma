"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { accountingService } from "@/services/admin-api.service";

const REPORTS = [
  { id: "sales", label: "Satış" },
  { id: "collections", label: "Tahsilat" },
  { id: "current-account", label: "Cari" },
  { id: "debtors", label: "Borçlu müşteriler" },
  { id: "overdue", label: "Vadesi geçenler" },
  { id: "top-customers", label: "En yüksek satış" },
] as const;

export default function FinanceReportsPage() {
  const [report, setReport] =
    useState<(typeof REPORTS)[number]["id"]>("sales");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-report", report, dateFrom, dateTo],
    queryFn: () =>
      accountingService.report(report, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  return (
    <ModulePage permission="accounting.read">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Finans Raporları
        </h1>
        <p className="text-sm text-slate-500">
          Backend aggregation. Timezone: Europe/Istanbul (collections summary).
        </p>

        <div className="flex flex-wrap gap-2">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReport(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                report === r.id
                  ? "bg-[#0f2744] text-white"
                  : "border bg-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
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
          <a
            href={`/api-proxy-not-used`}
            onClick={(e) => {
              e.preventDefault();
              const q = new URLSearchParams({ format: "csv" });
              if (dateFrom) q.set("dateFrom", dateFrom);
              if (dateTo) q.set("dateTo", dateTo);
              window.open(
                `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/admin/finance/reports/${report}?${q}`,
                "_blank",
              );
            }}
            className="rounded border bg-white px-3 py-1.5 text-sm"
          >
            CSV
          </a>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Rapor alınamadı.</p>
        ) : (
          <pre className="overflow-auto rounded-xl border bg-white p-4 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </ModulePage>
  );
}
