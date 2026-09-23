import { useState } from "react";
import { ModalShell } from "./CustomerModal";
import { usePosStore } from "../store/pos-store";

export function DiscountModal({ onClose }: { onClose: () => void }) {
  const setAmount = usePosStore((s) => s.setCartDiscountAmount);
  const setPercent = usePosStore((s) => s.setCartDiscountPercent);
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [value, setValue] = useState("");

  function apply() {
    if (mode === "amount") setAmount(value || "0");
    else setPercent(value || "0");
    onClose();
  }

  return (
    <ModalShell title="İskonto (F6)" onClose={onClose}>
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-xl px-4 py-2 font-medium ${
            mode === "amount"
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--border)]"
          }`}
          onClick={() => setMode("amount")}
        >
          Tutar (₺)
        </button>
        <button
          type="button"
          className={`rounded-xl px-4 py-2 font-medium ${
            mode === "percent"
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--border)]"
          }`}
          onClick={() => setMode("percent")}
        >
          Yüzde (%)
        </button>
      </div>
      <input
        autoFocus
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        className="mt-4 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-lg outline-none focus:border-[var(--primary)]"
        placeholder={mode === "amount" ? "0.00" : "0"}
      />
      <button
        type="button"
        onClick={apply}
        className="mt-4 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-white"
      >
        Uygula
      </button>
    </ModalShell>
  );
}
