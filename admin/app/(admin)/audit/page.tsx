"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { auditService } from "@/services/admin-api.service";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const query = useQuery({
    queryKey: ["admin-audit", page, action, entityType],
    queryFn: () =>
      auditService.list(page, 30, {
        action: action || undefined,
        entityType: entityType || undefined,
      }),
  });

  return (
    <ModulePage permission="audit.read">
      <div className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Audit Logs
          </h2>
          <p className="text-sm text-slate-500">
            Admin kritik işlem kayıtları
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Action (örn. PRODUCT_UPDATED)"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Entity (örn. Product)"
            value={entityType}
            onChange={(e) => {
              setPage(1);
              setEntityType(e.target.value);
            }}
          />
        </div>

        {query.isLoading ? (
          <p>Yükleniyor…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Zaman</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Entity ID</th>
                  <th className="px-3 py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.items ?? []).map((log) => (
                  <tr key={log.id} className="border-t align-top">
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {log.adminUserId.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">{log.entityType}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {log.entityId?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {log.metadata
                        ? JSON.stringify(log.metadata).slice(0, 120)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t px-3 py-2 text-xs text-slate-500">
              <span>Toplam: {query.data?.meta.total ?? 0}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-2 py-1"
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
