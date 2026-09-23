import { ModalShell } from "./CustomerModal";
import type { PosProductLookup } from "../types/api";
import { formatTry } from "../utils/money";

export function ProductPickModal({
  products,
  onPick,
  onClose,
}: {
  products: PosProductLookup[];
  onPick: (p: PosProductLookup) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Ürün Seç" onClose={onClose}>
      <ul className="max-h-96 space-y-2 overflow-auto">
        {products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={!p.unitPrice}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-left hover:border-[var(--primary)]"
              onClick={() => onPick(p)}
            >
              <span>
                <span className="font-semibold">{p.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {p.sku} · stok {p.availableStock}
                </span>
              </span>
              <span className="font-bold tabular-nums">
                {p.unitPrice ? formatTry(p.unitPrice) : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
