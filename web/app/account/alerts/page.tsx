"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clientApiFetch } from "@/lib/api/client";

type Alert = {
  id: string;
  productId: string;
  active: boolean;
  createdAt: string;
  product?: { name: string; slug: string };
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["alerts"],
    queryFn: () => clientApiFetch<Alert[]>("/product-alerts"),
  });
  const remove = useMutation({
    mutationFn: (productId: string) =>
      clientApiFetch(`/products/${productId}/alerts`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  if (query.isLoading) return <p>Yükleniyor…</p>;
  if (!query.data?.length) {
    return <EmptyState title="Stok bildiriminiz yok" />;
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl text-navy">
        Stok Bildirimlerim
      </h1>
      <ul className="space-y-2">
        {query.data.map((alert) => (
          <li
            key={alert.id}
            className="flex items-center justify-between rounded border bg-white p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {alert.product?.name ?? alert.productId}
              </p>
              <p className="text-slate-500">
                {alert.active ? "Aktif" : "Tetiklendi"} ·{" "}
                {new Date(alert.createdAt).toLocaleDateString("tr-TR")}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove.mutate(alert.productId)}
            >
              İptal
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
