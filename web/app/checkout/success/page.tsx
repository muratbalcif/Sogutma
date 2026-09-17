import Link from "next/link";
import { catalogService } from "@/services/catalog.service";
import { serverApiFetch } from "@/lib/api/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  let order: {
    id: string;
    orderNumber: string;
    totalAmount: string;
    currency: string;
    status: string;
  } | null = null;

  if (orderId) {
    try {
      order = await serverApiFetch(`/orders/${orderId}`);
    } catch {
      order = null;
    }
  }

  const config = await catalogService.siteConfig().catch(() => null);

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-white p-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Siparişiniz başarıyla oluşturuldu
      </h1>
      {order ? (
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          <p>
            Sipariş no: <strong>{order.orderNumber}</strong>
          </p>
          <p>
            Toplam: {order.totalAmount} {order.currency}
          </p>
          <p>Durum: {order.status}</p>
        </div>
      ) : null}
      {config?.bankTransferInfo.iban ? (
        <div className="mt-6 rounded border border-dashed p-4 text-left text-sm">
          <p className="font-semibold">Havale bilgileri</p>
          <p>{config.bankTransferInfo.bankName}</p>
          <p>{config.bankTransferInfo.accountName}</p>
          <p className="font-mono">{config.bankTransferInfo.iban}</p>
          {orderId ? (
            <Link
              href={`/account/bank-transfers?orderId=${orderId}`}
              className="mt-3 inline-flex text-accent"
            >
              Havale bildirimi yap
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        {orderId ? (
          <Link
            href={`/account/orders/${orderId}`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Sipariş detayı
          </Link>
        ) : null}
        <Link
          href="/products"
          className="rounded-md border px-4 py-2 text-sm font-semibold"
        >
          Alışverişe devam et
        </Link>
      </div>
    </div>
  );
}
