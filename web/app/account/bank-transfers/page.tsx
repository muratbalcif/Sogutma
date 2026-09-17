import { Suspense } from "react";
import BankTransfersClient from "./bank-transfers-client";

export default function BankTransfersPage() {
  return (
    <Suspense fallback={<p>Yükleniyor…</p>}>
      <BankTransfersClient />
    </Suspense>
  );
}
