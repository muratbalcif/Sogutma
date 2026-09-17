"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { usePermissions } from "@/hooks/use-permissions";
import { accountingService } from "@/services/admin-api.service";

export default function AccountingPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customerId: "",
    direction: "DEBIT" as "DEBIT" | "CREDIT",
    amount: "",
    description: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-accounting"],
    queryFn: () => accountingService.listTransactions(1, 50),
  });

  const mutation = useMutation({
    mutationFn: () => accountingService.createManual(form),
    onSuccess: () => {
      setForm({
        customerId: "",
        direction: "DEBIT",
        amount: "",
        description: "",
      });
      void qc.invalidateQueries({ queryKey: ["admin-accounting"] });
    },
  });

  return (
    <ModulePage permission="accounting.read">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Cari Hesap
        </h1>
        <p className="text-sm text-slate-500">
          Ledger immutable. Düzeltmeler ADJUSTMENT / REVERSAL ile yapılır; hard
          delete yok.
        </p>

        {can("accounting.create") && (
          <form
            className="flex flex-wrap gap-2 rounded-xl border bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <input
              required
              value={form.customerId}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerId: e.target.value }))
              }
              placeholder="Müşteri UUID"
              className="min-w-[220px] rounded border px-2 py-1.5 text-sm"
            />
            <select
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  direction: e.target.value as "DEBIT" | "CREDIT",
                }))
              }
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="DEBIT">Borç</option>
              <option value="CREDIT">Alacak</option>
            </select>
            <input
              required
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              placeholder="Tutar"
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              required
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Açıklama"
              className="min-w-[180px] flex-1 rounded border px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#0f2744] px-3 py-1.5 text-sm text-white"
            >
              Manuel hareket
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">Borç</th>
                  <th className="px-4 py-3 font-medium">Alacak</th>
                  <th className="px-4 py-3 font-medium">Bakiye</th>
                  <th className="px-4 py-3 font-medium">Açıklama</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3">{row.debit ?? ""}</td>
                    <td className="px-4 py-3">{row.credit ?? ""}</td>
                    <td className="px-4 py-3">{row.balanceAfter ?? ""}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(row.createdAt).toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModulePage>
  );
}
