import { useMemo, useState } from "react";
import { ModalShell } from "./CustomerModal";
import type { PosPaymentMethod } from "../types/api";
import { amountsEqual, formatTry, money, sumAmounts } from "../utils/money";

const METHODS: Array<{ method: PosPaymentMethod; label: string }> = [
  { method: "CASH", label: "NAKİT" },
  { method: "CARD", label: "KART" },
  { method: "BANK_TRANSFER", label: "HAVALE/EFT" },
  { method: "ON_ACCOUNT", label: "VERESİYE" },
];

type Draft = { method: PosPaymentMethod; amount: string };

export function PaymentModal({
  total,
  hasCustomer,
  submitting,
  onClose,
  onConfirm,
}: {
  total: string;
  hasCustomer: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (
    payments: Array<{ method: PosPaymentMethod; amount: number }>,
  ) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([
    { method: "CASH", amount: total },
  ]);
  const [error, setError] = useState<string | null>(null);

  const paid = useMemo(
    () => sumAmounts(drafts.map((d) => d.amount || 0)),
    [drafts],
  );
  const remaining = money(total).sub(money(paid)).toFixed(2);

  function setSingle(method: PosPaymentMethod) {
    if (method === "ON_ACCOUNT" && !hasCustomer) {
      setError("Veresiye için müşteri seçimi zorunlu");
      return;
    }
    setError(null);
    setDrafts([{ method, amount: total }]);
  }

  function updateAmount(index: number, amount: string) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, amount } : d)),
    );
  }

  function addSplit(method: PosPaymentMethod) {
    if (method === "ON_ACCOUNT" && !hasCustomer) {
      setError("Veresiye için müşteri seçimi zorunlu");
      return;
    }
    setError(null);
    const rem = money(remaining);
    if (rem.lessThanOrEqualTo(0)) return;
    setDrafts((prev) => [...prev, { method, amount: rem.toFixed(2) }]);
  }

  function confirm() {
    if (drafts.some((d) => d.method === "ON_ACCOUNT") && !hasCustomer) {
      setError("Veresiye için müşteri seçimi zorunlu");
      return;
    }
    if (!amountsEqual(paid, total)) {
      setError(`Ödeme toplamı (${formatTry(paid)}) satış tutarıyla eşleşmiyor`);
      return;
    }
    if (drafts.some((d) => money(d.amount).lessThanOrEqualTo(0))) {
      setError("Ödeme tutarları pozitif olmalı");
      return;
    }
    onConfirm(
      drafts.map((d) => ({
        method: d.method,
        amount: money(d.amount).toNumber(),
      })),
    );
  }

  return (
    <ModalShell title="Ödeme (F8 / F12)" onClose={onClose} wide>
      <p className="text-sm text-slate-500">Toplam</p>
      <p className="text-4xl font-bold tabular-nums">{formatTry(total)}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {METHODS.map((m) => (
          <button
            key={m.method}
            type="button"
            disabled={submitting}
            onClick={() => setSingle(m.method)}
            className="rounded-xl border-2 border-[var(--border)] py-4 text-sm font-bold hover:border-[var(--primary)]"
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase text-slate-500">
          Ödeme satırları (split)
        </p>
        {drafts.map((d, i) => (
          <div key={`${d.method}-${i}`} className="flex items-center gap-2">
            <span className="w-32 text-sm font-medium">{d.method}</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              disabled={submitting}
              value={d.amount}
              onChange={(e) => updateAmount(i, e.target.value)}
              className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 tabular-nums"
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {METHODS.map((m) => (
            <button
              key={`add-${m.method}`}
              type="button"
              disabled={submitting}
              className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs"
              onClick={() => addSplit(m.method)}
            >
              + {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span>Ödenen: {formatTry(paid)}</span>
        <span
          className={
            amountsEqual(remaining, 0)
              ? "text-[var(--success)]"
              : "text-[var(--error)]"
          }
        >
          Kalan: {formatTry(remaining)}
        </span>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={confirm}
        className="mt-5 w-full rounded-2xl bg-[var(--primary)] py-4 text-lg font-bold text-white hover:bg-[var(--primary-dark)]"
      >
        {submitting ? "Satış işleniyor…" : "SATIŞI TAMAMLA"}
      </button>
    </ModalShell>
  );
}
