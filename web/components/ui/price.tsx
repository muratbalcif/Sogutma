import { formatMoney, shouldShowCompareAt } from "@/lib/money";

export function Price({
  amount,
  currency = "TRY",
  compareAt,
}: {
  amount: string;
  currency?: string;
  compareAt?: string | null;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold text-navy">
        {formatMoney(amount, currency)}
      </span>
      {shouldShowCompareAt(amount, compareAt) ? (
        <span className="text-sm text-slate-400 line-through">
          {formatMoney(compareAt!, currency)}
        </span>
      ) : null}
    </div>
  );
}
