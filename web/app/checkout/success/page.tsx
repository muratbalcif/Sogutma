import { serverApiFetch } from "@/lib/api/server";
import {
  CheckoutSuccessClient,
  type SuccessBankAccount,
  type SuccessOrder,
} from "./checkout-success-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const orderId = firstParam(params.orderId);
  const bankAccountId = firstParam(params.bankAccountId);

  let order: SuccessOrder | null = null;
  let banks: SuccessBankAccount[] = [];

  if (orderId) {
    try {
      const fetched = await serverApiFetch<
        SuccessOrder & { bankAccounts?: SuccessBankAccount[] }
      >(`/orders/${orderId}`);
      order = fetched;
      banks = fetched.bankAccounts ?? [];
    } catch {
      order = null;
    }
  }

  if (banks.length === 0) {
    try {
      banks = await serverApiFetch<SuccessBankAccount[]>(
        "/payment/bank-accounts",
      );
    } catch {
      banks = [];
    }
  }

  return (
    <CheckoutSuccessClient
      order={order}
      banks={banks}
      initialBankAccountId={bankAccountId}
    />
  );
}
