"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { clientApiFetch } from "@/lib/api/client";
import type { Paginated } from "@/types/api";

type Transfer = {
  id: string;
  status: string;
  amount: string;
  referenceNumber: string | null;
  createdAt: string;
};

export default function BankTransfersClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["bank-transfers"],
    queryFn: () =>
      clientApiFetch<Paginated<Transfer>>("/bank-transfers?page=1&limit=50"),
  });
  const [form, setForm] = useState({
    senderName: "",
    senderIban: "",
    transferDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    note: "",
  });

  const create = useMutation({
    mutationFn: () =>
      clientApiFetch(`/orders/${orderId}/bank-transfer`, {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bank-transfers"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Havale Bildirimlerim
      </h1>
      {orderId ? (
        <form
          className="grid gap-2 rounded border bg-white p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <p className="sm:col-span-2 text-sm text-slate-600">
            Sipariş için bildirim: {orderId}
          </p>
          <Input
            placeholder="Gönderen adı"
            value={form.senderName}
            onChange={(e) =>
              setForm((s) => ({ ...s, senderName: e.target.value }))
            }
          />
          <Input
            placeholder="IBAN (opsiyonel)"
            value={form.senderIban}
            onChange={(e) =>
              setForm((s) => ({ ...s, senderIban: e.target.value }))
            }
          />
          <Input
            type="date"
            value={form.transferDate}
            onChange={(e) =>
              setForm((s) => ({ ...s, transferDate: e.target.value }))
            }
          />
          <Input
            placeholder="Referans"
            value={form.referenceNumber}
            onChange={(e) =>
              setForm((s) => ({ ...s, referenceNumber: e.target.value }))
            }
          />
          <Button type="submit" className="sm:col-span-2">
            Bildirim gönder
          </Button>
        </form>
      ) : null}
      {!list.data?.items.length ? (
        <EmptyState title="Havale bildirimi yok" />
      ) : (
        <ul className="space-y-2">
          {list.data.items.map((item) => (
            <li key={item.id} className="rounded border bg-white p-3 text-sm">
              <div className="flex justify-between">
                <span>{item.status}</span>
                <span className="font-medium">{item.amount}</span>
              </div>
              <p className="text-slate-500">
                {item.referenceNumber ?? "—"} ·{" "}
                {new Date(item.createdAt).toLocaleDateString("tr-TR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
