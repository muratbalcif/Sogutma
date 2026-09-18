"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clientApiFetch } from "@/lib/api/client";
import type { Paginated } from "@/types/api";

type Transfer = {
  id: string;
  status: string;
  amount: string;
  amountMismatch?: boolean;
  remainingAmount?: string;
  approvedTotal?: string;
  paymentStatus?: string;
  orderTotal?: string;
  referenceNumber: string | null;
  bankName?: string | null;
  createdAt: string;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  branch?: string | null;
  description?: string | null;
};

type OrderPayment = {
  id: string;
  status: string;
  amount: string;
  remainingAmount?: string;
  approvedTotal?: string;
  paymentReference?: string | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  currency: string;
  totalAmount: string;
  payment: OrderPayment | null;
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

function bankInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      onClick={async () => {
        await copyText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Kopyalandı" : label}
    </button>
  );
}

export default function BankTransfersClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const queryClient = useQueryClient();
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["bank-transfers"],
    queryFn: () =>
      clientApiFetch<Paginated<Transfer>>("/bank-transfers?page=1&limit=50"),
  });
  const banks = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => clientApiFetch<BankAccount[]>("/payment/bank-accounts"),
  });
  const order = useQuery({
    queryKey: ["order-for-transfer", orderId],
    queryFn: () => clientApiFetch<OrderDetail>(`/orders/${orderId}`),
    enabled: Boolean(orderId),
  });

  const remaining =
    order.data?.payment?.remainingAmount ?? order.data?.totalAmount ?? "";
  const approved = order.data?.payment?.approvedTotal ?? "0.00";
  const paymentReference = order.data?.payment?.paymentReference ?? "";
  const selectedBank =
    (banks.data ?? []).find((b) => b.id === selectedBankId) ?? null;
  const canClaim =
    Boolean(orderId) &&
    Boolean(selectedBankId) &&
    (order.data?.payment?.status === "PENDING" ||
      order.data?.payment?.status === "PARTIALLY_PAID");

  const create = useMutation({
    mutationFn: () => {
      if (!selectedBankId) {
        throw new Error("Lütfen bir banka hesabı seçin");
      }
      return clientApiFetch(`/orders/${orderId}/bank-transfer`, {
        method: "POST",
        body: JSON.stringify({
          bankAccountId: selectedBankId,
          amount: remaining || undefined,
        }),
      });
    },
    onSuccess: () => {
      setError(null);
      setSuccess("Ödeme bildiriminiz alındı. Onay sonrası bakiyeniz güncellenir.");
      queryClient.invalidateQueries({ queryKey: ["bank-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["order-for-transfer", orderId] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Havale / EFT ile Öde
      </h1>

      {orderId ? (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-600">
            Sipariş:{" "}
            <strong>{order.data?.orderNumber ?? orderId}</strong>
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(banks.data ?? []).map((bank) => {
              const selected = selectedBankId === bank.id;
              return (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => setSelectedBankId(bank.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selected
                      ? "border-[#0F766E] bg-[#0F766E]/5 ring-2 ring-[#0F766E]"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${
                        selected
                          ? "bg-[#0F766E] text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {bankInitials(bank.bankName)}
                    </span>
                    <div>
                      <p className="font-semibold text-navy">{bank.bankName}</p>
                      <p className="text-xs text-slate-500">{bank.accountName}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm break-all">{bank.iban}</p>
                  {bank.branch ? (
                    <p className="mt-1 text-xs text-slate-500">Şube: {bank.branch}</p>
                  ) : null}
                  <div
                    className="mt-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <CopyButton value={bank.iban} label="IBAN'ı Kopyala" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-sm text-slate-600">
            Listelenen hesaplardan herhangi birine, kendi bankanızdan EFT/havale
            yapabilirsiniz. Bu bankada hesabınız yoksa başka bankanızdan
            EFT/havale yapabilirsiniz.
          </p>

          {selectedBank ? (
            <div className="rounded-md border border-[#0F766E]/30 bg-[#0F766E]/5 p-4 text-sm">
              <p className="font-semibold text-[#0F766E]">Seçilen hesap</p>
              <p>
                {selectedBank.bankName} · {selectedBank.accountName}
              </p>
              <p className="font-mono">{selectedBank.iban}</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-500">Sipariş toplamı</p>
                    <p className="font-medium">
                      {order.data?.totalAmount} {order.data?.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-500">Ödenen</p>
                    <p className="font-medium">
                      {approved} {order.data?.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-500">Kalan / Tutar</p>
                    <p className="font-medium">
                      {remaining} {order.data?.currency}
                    </p>
                  </div>
                  {remaining ? (
                    <CopyButton value={remaining} label="Kopyala" />
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-500">Ödeme referansı</p>
                    <p className="font-mono text-xs">
                      {paymentReference || "—"}
                    </p>
                  </div>
                  {paymentReference ? (
                    <CopyButton value={paymentReference} label="Kopyala" />
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Havale açıklamasına ödeme referansını yazın. Onaylanmadan ödeme
                tamamlanmış sayılmaz.
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium text-amber-800">
              Ödemeyi bildirmek için bir banka hesabı seçin.
            </p>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <Button
            type="button"
            disabled={!canClaim || create.isPending}
            onClick={() => create.mutate()}
            className="bg-[#0F766E] hover:bg-[#0d635c]"
          >
            {create.isPending ? "Gönderiliyor…" : "Ödemeyi Yaptım"}
          </Button>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-lg font-semibold text-navy">Bildirim geçmişi</h2>
        {!list.data?.items.length ? (
          <EmptyState title="Havale bildirimi yok" />
        ) : (
          <ul className="space-y-2">
            {list.data.items.map((item) => (
              <li key={item.id} className="rounded border bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span>{statusLabel(item.status)}</span>
                  <span className="font-medium">{item.amount}</span>
                </div>
                <p className="text-slate-500">
                  {item.bankName ?? "—"} · {item.referenceNumber ?? "—"} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                  {item.paymentStatus ? ` · Ödeme: ${item.paymentStatus}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
