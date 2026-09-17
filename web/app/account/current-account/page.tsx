import { serverApiFetch } from "@/lib/api/server";
import type { Paginated } from "@/types/api";

export default async function CurrentAccountPage() {
  const summary = await serverApiFetch<{
    totalDebit: string;
    totalCredit: string;
    balance: string;
    currency: string;
  }>("/account/current").catch(() => null);

  const transactions = await serverApiFetch<
    Paginated<{
      id: string;
      type: string;
      amount: string;
      description: string;
      createdAt: string;
    }>
  >("/account/transactions?page=1&limit=50").catch(() => ({
    items: [],
    meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Cari Hesabım
      </h1>
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border bg-white p-4">
            <p className="text-sm text-slate-500">Borç</p>
            <p className="text-xl font-semibold">
              {summary.totalDebit} {summary.currency}
            </p>
          </div>
          <div className="rounded border bg-white p-4">
            <p className="text-sm text-slate-500">Alacak</p>
            <p className="text-xl font-semibold">
              {summary.totalCredit} {summary.currency}
            </p>
          </div>
          <div className="rounded border bg-white p-4">
            <p className="text-sm text-slate-500">Bakiye</p>
            <p className="text-xl font-semibold">
              {summary.balance} {summary.currency}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Cari hesap bilgisi alınamadı.</p>
      )}
      <ul className="space-y-2">
        {transactions.items.map((tx) => (
          <li key={tx.id} className="rounded border bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span>{tx.type}</span>
              <span className="font-medium">{tx.amount}</span>
            </div>
            <p className="text-slate-500">{tx.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
