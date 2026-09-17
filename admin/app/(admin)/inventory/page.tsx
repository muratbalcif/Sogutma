"use client";

import { ModulePage } from "@/components/auth/module-page";
import { DataPageShell } from "@/components/ui/data-page-shell";
import { inventoryService } from "@/services/admin-api.service";

export default function InventoryPage() {
  return (
    <ModulePage permission="stock.read">
      <DataPageShell
        title="Stok"
        permission="stock.read"
        queryKey={["admin-inventory"]}
        queryFn={() => inventoryService.list(1, 50)}
      >
        {(data) => (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Ürün ID</th>
                  <th className="px-4 py-3 font-medium">Miktar</th>
                  <th className="px-4 py-3 font-medium">Rezerve</th>
                  <th className="px-4 py-3 font-medium">Kullanılabilir</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{row.productId}</td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3">{row.reservedQuantity}</td>
                    <td className="px-4 py-3">{row.availableQuantity}</td>
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
