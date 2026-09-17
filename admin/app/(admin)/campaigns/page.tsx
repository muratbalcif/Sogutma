"use client";

import { ModulePage } from "@/components/auth/module-page";
import { DataPageShell } from "@/components/ui/data-page-shell";
import { campaignsService } from "@/services/admin-api.service";

export default function CampaignsPage() {
  return (
    <ModulePage permission="campaign.read">
      <DataPageShell
        title="Kampanyalar"
        permission="campaign.read"
        queryKey={["admin-campaigns"]}
        queryFn={() => campaignsService.list()}
      >
        {(data) => (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Ad</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Aktif</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.slug}</td>
                    <td className="px-4 py-3">{row.active ? "Evet" : "Hayır"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(row.startsAt).toLocaleDateString("tr-TR")} –{" "}
                      {new Date(row.endsAt).toLocaleDateString("tr-TR")}
                    </td>
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
