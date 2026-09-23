import { ModalShell } from "./CustomerModal";
import type { PosSale } from "../types/api";
import { formatTry } from "../utils/money";

export function SaleSuccessModal({
  sale,
  onNewSale,
}: {
  sale: PosSale;
  onNewSale: () => void;
}) {
  return (
    <ModalShell title="SATIŞ TAMAMLANDI" onClose={onNewSale}>
      <p className="text-center text-2xl font-bold text-[var(--success)]">
        {sale.saleNumber}
      </p>
      <p className="mt-4 text-center text-sm text-slate-500">Toplam</p>
      <p className="text-center text-4xl font-bold tabular-nums">
        {formatTry(sale.grandTotal)}
      </p>
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        {sale.payments.map((p) => (
          <li key={p.id} className="flex justify-between">
            <span>{p.method}</span>
            <span className="tabular-nums">{formatTry(p.amount)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        autoFocus
        onClick={onNewSale}
        className="mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-lg font-bold text-white"
      >
        N · Yeni Satış
      </button>
    </ModalShell>
  );
}
