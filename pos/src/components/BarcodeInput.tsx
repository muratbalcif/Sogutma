import { forwardRef, KeyboardEvent, useState } from "react";

export const BarcodeInput = forwardRef<
  HTMLInputElement,
  {
    onSubmit: (value: string) => void;
    disabled?: boolean;
  }
>(function BarcodeInput({ onSubmit, disabled }, ref) {
  const [value, setValue] = useState("");

  function submit() {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div>
      <label
        htmlFor="barcode-input"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Barkod / Ürün Ara
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="barcode-input"
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Barkod okutun veya yazın + Enter"
          className="w-full rounded-xl border-2 border-[var(--primary)] px-4 py-3 text-lg outline-none focus:ring-4 focus:ring-[var(--primary)]/20"
          autoComplete="off"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="rounded-xl bg-[var(--primary)] px-4 py-3 font-semibold text-white"
          aria-label="Ara"
        >
          🔍
        </button>
      </div>
    </div>
  );
});
