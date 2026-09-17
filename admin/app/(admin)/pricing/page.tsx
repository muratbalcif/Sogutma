"use client";

import { ModulePage } from "@/components/auth/module-page";

export default function PricingPage() {
  return (
    <ModulePage permission="pricing.read">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Fiyatlandırma
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Admin fiyat uçları ürün/müşteri bazlıdır (
          <code className="rounded bg-slate-100 px-1">
            /admin/pricing/products/:productId
          </code>
          ). Bu ekranda genel liste API&apos;si yoktur; ürün detay
          entegrasyonu sonraki milestone&apos;da gelecek.
        </p>
      </div>
    </ModulePage>
  );
}
