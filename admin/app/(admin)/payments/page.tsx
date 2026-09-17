"use client";

import { ModulePage } from "@/components/auth/module-page";
import { DataPageShell } from "@/components/ui/data-page-shell";
import { paymentsService } from "@/services/admin-api.service";

export default function PaymentsPage() {
  return (
    <ModulePage permission="payment.read">
      <DataPageShell
        title="Ödemeler"
        permission="payment.read"
        queryKey={["admin-payments"]}
        queryFn={() => paymentsService.list(1, 50)}
      >
        {(data) => (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 font-medium">Tutar</th>
                  <th className="px-4 py-3 font-medium">Sağlayıcı</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {row.amount} {row.currency}
                    </td>
                    <td className="px-4 py-3">{row.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Toplam: {data.meta.total}
            </div>
          </div>
        )}
      </DataPageShell>
    </ModulePage>
  );
}
