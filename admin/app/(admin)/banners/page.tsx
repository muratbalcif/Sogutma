"use client";

import { ModulePage } from "@/components/auth/module-page";
import { DataPageShell } from "@/components/ui/data-page-shell";
import { bannersService } from "@/services/admin-api.service";

export default function BannersPage() {
  return (
    <ModulePage permission="banner.read">
      <DataPageShell
        title="Bannerlar"
        permission="banner.read"
        queryKey={["admin-banners"]}
        queryFn={() => bannersService.list()}
      >
        {(data) => (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Başlık</th>
                  <th className="px-4 py-3 font-medium">Sıra</th>
                  <th className="px-4 py-3 font-medium">Aktif</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">{row.sortOrder}</td>
                    <td className="px-4 py-3">{row.active ? "Evet" : "Hayır"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPageShell>
    </ModulePage>
  );
}
