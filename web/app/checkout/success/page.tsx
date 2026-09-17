import Link from "next/link";
import { serverApiFetch } from "@/lib/api/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
};

type Order = {
  id: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  status: string;
  payment: {
    status: string;
    method: string;
    amount: string;
  } | null;
  bankAccounts?: BankAccount[];
};

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Ödeme bekleniyor";
    case "PAID":
      return "Ödeme alındı";
    case "FAILED":
      return "Ödeme doğrulanamadı";
    case "CANCELLED":
      return "Ödeme iptal edildi";
    default:
      return status ?? "—";
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  let order: Order | null = null;
  let banks: BankAccount[] = [];

  if (orderId) {
    try {
      order = await serverApiFetch<Order>(`/orders/${orderId}`);
      banks = order.bankAccounts ?? [];
    } catch {
      order = null;
    }
  }

  if (banks.length === 0) {
    try {
      banks = await serverApiFetch<BankAccount[]>("/payment/bank-accounts");
    } catch {
      banks = [];
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-white p-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Siparişiniz oluşturuldu.
      </h1>
      {order ? (
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          <p>
            Sipariş no: <strong>{order.orderNumber}</strong>
          </p>
          <p>
            Toplam tutar: {order.totalAmount} {order.currency}
          </p>
          <p>Ödeme yöntemi: Havale / EFT</p>
          <p>Ödeme durumu: {paymentStatusLabel(order.payment?.status)}</p>
        </div>
      ) : null}
      {banks.length > 0 ? (
        <div className="mt-6 space-y-3 text-left text-sm">
          <p className="font-semibold">Banka bilgileri</p>
          {banks.map((bank) => (
            <div key={bank.id} className="rounded border border-dashed p-4">
              <p>{bank.bankName}</p>
              <p>{bank.accountName}</p>
              <p className="font-mono">{bank.iban}</p>
            </div>
          ))}
          {orderId ? (
            <Link
              href={`/account/bank-transfers?orderId=${orderId}`}
              className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Havale Bildirimi Yap
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        {orderId ? (
          <Link
            href={`/account/orders/${orderId}`}
            className="rounded-md border px-4 py-2 text-sm font-semibold"
          >
            Siparişi Görüntüle
          </Link>
        ) : null}
        <Link
          href="/products"
          className="rounded-md border px-4 py-2 text-sm font-semibold"
        >
          Alışverişe Devam Et
        </Link>
      </div>
    </div>
  );
}
