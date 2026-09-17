"use client";

import { ModulePage } from "@/components/auth/module-page";

export default function CustomersPage() {
  return (
    <ModulePage permission="customer.read">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Müşteriler
        </h3>
        <p className="mt-2 text-sm">
          Backend&apos;de henüz{" "}
          <code className="rounded bg-white/70 px-1">GET /admin/customers</code>{" "}
          listesi yok. Bu sayfa uydurma veri göstermez; müşteri listesi API&apos;si
          eklendiğinde buraya bağlanacak.
        </p>
      </div>
    </ModulePage>
  );
}
