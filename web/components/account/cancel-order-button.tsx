"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clientApiFetch } from "@/lib/api/client";

type Props = {
  orderId: string;
};

export function CancelOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm("Siparişi iptal etmek istediğinize emin misiniz?")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await clientApiFetch(`/orders/${orderId}/cancel`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İptal başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={loading}
        onClick={() => void handleCancel()}
      >
        {loading ? "İptal ediliyor…" : "Siparişi İptal Et"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
