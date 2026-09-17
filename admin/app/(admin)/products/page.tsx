"use client";

import { ModulePage } from "@/components/auth/module-page";
import { DataPageShell } from "@/components/ui/data-page-shell";
import { catalogService } from "@/services/admin-api.service";

export default function ProductsPage() {
  return (
    <ModulePage permission="product.read">
      <DataPageShell
        title="Ürünler"
        permission="product.read"
        queryKey={["admin-products"]}
        queryFn={() => catalogService.listProducts(1, 50)}
      >
        {(data) => (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Ad</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                    <td className="px-4 py-3">{product.name}</td>
                    <td className="px-4 py-3 text-slate-500">{product.slug}</td>
                    <td className="px-4 py-3">
                      {product.active ? "Aktif" : "Pasif"}
                    </td>
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
