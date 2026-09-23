import { usePosStore } from "../store/pos-store";
import { formatTry, lineTotal } from "../utils/money";

export function CartPanel({
  total,
  onPay,
  selectedId,
  onSelect,
  onInc,
  onDec,
  onRemove,
}: {
  total: string;
  onPay: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const cartDiscountAmount = usePosStore((s) => s.cartDiscountAmount);

  return (
    <section className="flex min-h-0 flex-col bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">SEPET</h2>
        {customer ? (
          <span className="rounded-full bg-[var(--primary-light)] px-3 py-1 text-sm font-medium text-[var(--primary-dark)]">
            {customer.name}
          </span>
        ) : (
          <span className="text-sm text-slate-500">Misafir satış</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-white">
        {cart.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Sepet boş</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Ürün</th>
                <th className="px-3 py-2 text-center">Adet</th>
                <th className="px-3 py-2 text-right">Fiyat</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {cart.map((line) => {
                const selected = selectedId === line.productId;
                return (
                  <tr
                    key={line.productId}
                    className={
                      selected
                        ? "bg-[var(--primary-light)]"
                        : "border-t border-slate-100 hover:bg-slate-50"
                    }
                    onClick={() => onSelect(line.productId)}
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        {line.sku}
                        {line.barcode ? ` · ${line.barcode}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg border border-slate-300 font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDec(line.productId);
                          }}
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-base font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg border border-slate-300 font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInc(line.productId);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatTry(line.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatTry(lineTotal(line.unitPrice, line.quantity))}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--error)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(line.productId);
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
        {Number(cartDiscountAmount) > 0 ? (
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>İskonto</span>
            <span>−{formatTry(cartDiscountAmount)}</span>
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Toplam</p>
            <p className="text-4xl font-bold tabular-nums text-[var(--text)]">
              {formatTry(total)}
            </p>
          </div>
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onPay}
            className="rounded-2xl bg-[var(--accent)] px-8 py-4 text-lg font-bold text-slate-900 shadow hover:brightness-95"
          >
            ÖDEME (F8)
          </button>
        </div>
      </div>
    </section>
  );
}
