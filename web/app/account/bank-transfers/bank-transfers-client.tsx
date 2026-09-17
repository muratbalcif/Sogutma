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
  amountMismatch?: boolean;
  referenceNumber: string | null;
  createdAt: string;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
};

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "İnceleniyor";
    case "APPROVED":
      return "Onaylandı";
    case "REJECTED":
      return "Reddedildi";
    default:
      return status;
  }
}

export default function BankTransfersClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["bank-transfers"],
    queryFn: () =>
      clientApiFetch<Paginated<Transfer>>("/bank-transfers?page=1&limit=50"),
  });
  const banks = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => clientApiFetch<BankAccount[]>("/payment/bank-accounts"),
  });
  const [form, setForm] = useState({
    senderName: "",
    senderIban: "",
    transferDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    note: "",
    amount: "",
    bankAccountId: "",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      clientApiFetch(`/orders/${orderId}/bank-transfer`, {
        method: "POST",
        body: JSON.stringify({
          senderName: form.senderName,
          senderIban: form.senderIban || undefined,
          transferDate: form.transferDate,
          referenceNumber: form.referenceNumber || undefined,
          note: form.note || undefined,
          amount: form.amount || undefined,
          bankAccountId: form.bankAccountId || undefined,
        }),
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["bank-transfers"] });
    },
    onError: (err: Error) => setError(err.message),
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
            required
          />
          <Input
            placeholder="Tutar (opsiyonel)"
            value={form.amount}
            onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={form.bankAccountId}
            onChange={(e) =>
              setForm((s) => ({ ...s, bankAccountId: e.target.value }))
            }
          >
            <option value="">Banka seçin</option>
            {(banks.data ?? []).map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.bankName} — {bank.iban}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={form.transferDate}
            onChange={(e) =>
              setForm((s) => ({ ...s, transferDate: e.target.value }))
            }
          />
          <Input
            placeholder="Dekont referans no"
            value={form.referenceNumber}
            onChange={(e) =>
              setForm((s) => ({ ...s, referenceNumber: e.target.value }))
            }
          />
          <Input
            placeholder="Açıklama"
            value={form.note}
            onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
          />
          {error ? (
            <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
          ) : null}
          <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
            {create.isPending ? "Gönderiliyor…" : "Bildirim gönder"}
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
                <span>{statusLabel(item.status)}</span>
                <span className="font-medium">
                  {item.amount}
                  {item.amountMismatch ? " (tutar uyuşmazlığı)" : ""}
                </span>
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
