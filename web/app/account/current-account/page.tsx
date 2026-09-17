import { serverApiFetch } from "@/lib/api/server";
import type { Paginated } from "@/types/api";

export default async function CurrentAccountPage() {
  const summary = await serverApiFetch<{
    totalDebit: string;
    totalCredit: string;
    balance: string;
    currency: string;
    overdueAmount?: string;
  }>("/account/current").catch(() => null);

  const transactions = await serverApiFetch<
    Paginated<{
      id: string;
      type: string;
      amount: string;
      debit: string | null;
      credit: string | null;
      balanceAfter: string | null;
      description: string;
      createdAt: string;
    }>
  >("/account/transactions?page=1&limit=50").catch(() => ({
    items: [],
    meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
          Cari Hesabım
        </h1>
        <a
          href="/account/current-account?export=1"
          className="text-sm text-navy underline"
        >
          Ekstre (API CSV: /account/statement?format=csv)
        </a>
      </div>
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
      <div className="overflow-hidden rounded border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Tarih</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2">Borç</th>
              <th className="px-3 py-2">Alacak</th>
              <th className="px-3 py-2">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {transactions.items.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="px-3 py-2">
                  {new Date(tx.createdAt).toLocaleString("tr-TR")}
                </td>
                <td className="px-3 py-2">{tx.description}</td>
                <td className="px-3 py-2">{tx.debit ?? ""}</td>
                <td className="px-3 py-2">{tx.credit ?? ""}</td>
                <td className="px-3 py-2">{tx.balanceAfter ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
