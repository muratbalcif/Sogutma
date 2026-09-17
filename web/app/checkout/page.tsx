"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientApiFetch } from "@/lib/api/client";

type Address = {
  id: string;
  title: string;
  city: string;
  district: string;
  addressLine: string;
  isDefault: boolean;
};

type Cart = {
  items: Array<{ product: { name: string }; quantity: number; subtotal: string | null }>;
  summary: { total: string; currency: string; subtotal: string };
};

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  branch: string | null;
  currency: string;
  description: string | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedIban, setCopiedIban] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    title: "Ev",
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    district: "",
    addressLine: "",
  });

  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<string | null>(null);

  const addressesQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: () => clientApiFetch<Address[]>("/addresses"),
  });
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => clientApiFetch<Cart>("/cart"),
  });
  const banksQuery = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => clientApiFetch<BankAccount[]>("/payment/bank-accounts"),
  });

  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const banks = banksQuery.data ?? [];

  async function validateCoupon() {
    setCouponMessage(null);
    setCouponDiscount(null);
    try {
      const result = await clientApiFetch<{
        valid: boolean;
        message?: string;
        discountAmount?: string;
      }>("/checkout/coupon/validate", {
        method: "POST",
        body: JSON.stringify({ code: couponCode }),
      });
      if (!result.valid) {
        setCouponMessage(result.message ?? "Kupon geçersiz");
        return;
      }
      setCouponDiscount(result.discountAmount ?? null);
      setCouponMessage(result.message ?? "Kupon uygulandı");
    } catch (err) {
      setCouponMessage(err instanceof Error ? err.message : "Kupon doğrulanamadı");
    }
  }

  async function saveAddress() {
    const created = await clientApiFetch<Address>("/addresses", {
      method: "POST",
      body: JSON.stringify(newAddress),
    });
    await addressesQuery.refetch();
    setShippingAddressId(created.id);
    setBillingAddressId(created.id);
  }

  async function copyIban(iban: string) {
    await navigator.clipboard.writeText(iban);
    setCopiedIban(iban);
  }

  async function placeOrder() {
    setCreating(true);
    setError(null);
    try {
      const order = await clientApiFetch<{ id: string; orderNumber: string }>(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            shippingAddressId,
            billingAddressId: billingAddressId || shippingAddressId,
            couponCode: couponCode.trim() || undefined,
          }),
        },
      );
      router.push(`/checkout/success?orderId=${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sipariş oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Checkout
      </h1>
      <div className="flex gap-2 text-sm">
        <span className={step === 1 ? "font-semibold text-accent" : ""}>1. Adres</span>
        <span>→</span>
        <span className={step === 2 ? "font-semibold text-accent" : ""}>2. Ödeme</span>
        <span>→</span>
        <span className={step === 3 ? "font-semibold text-accent" : ""}>3. Onay</span>
      </div>

      {step === 1 ? (
        <section className="space-y-4 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Teslimat adresi</h2>
          {addresses.map((address) => (
            <label key={address.id} className="flex gap-2 rounded border p-3 text-sm">
              <input
                type="radio"
                name="shipping"
                checked={shippingAddressId === address.id}
                onChange={() => {
                  setShippingAddressId(address.id);
                  setBillingAddressId(address.id);
                }}
              />
              <span>
                <strong>{address.title}</strong> — {address.addressLine},{" "}
                {address.district}/{address.city}
              </span>
            </label>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Ad"
              value={newAddress.firstName}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, firstName: e.target.value }))
              }
            />
            <Input
              placeholder="Soyad"
              value={newAddress.lastName}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, lastName: e.target.value }))
              }
            />
            <Input
              placeholder="Telefon"
              value={newAddress.phone}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, phone: e.target.value }))
              }
            />
            <Input
              placeholder="Şehir"
              value={newAddress.city}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, city: e.target.value }))
              }
            />
            <Input
              placeholder="İlçe"
              value={newAddress.district}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, district: e.target.value }))
              }
            />
            <Input
              placeholder="Adres"
              value={newAddress.addressLine}
              onChange={(e) =>
                setNewAddress((s) => ({ ...s, addressLine: e.target.value }))
              }
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => void saveAddress()}>
            Yeni adres kaydet
          </Button>
          <Button
            type="button"
            disabled={!shippingAddressId}
            onClick={() => setStep(2)}
          >
            Devam
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Ödeme yöntemi</h2>
          <label className="flex gap-2 text-sm font-medium">
            <input type="radio" checked readOnly />
            Havale / EFT
          </label>
          <p className="text-sm text-slate-600">
            İlk sürümde tek ödeme yöntemi havale/EFT&apos;dir. Online kart ödeme
            aktif değildir.
          </p>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Banka bilgileri</h3>
            {banksQuery.isLoading ? (
              <p className="text-sm text-slate-500">Hesaplar yükleniyor…</p>
            ) : banks.length === 0 ? (
              <p className="text-sm text-amber-700">
                Aktif banka hesabı bulunamadı. Lütfen destek ile iletişime geçin.
              </p>
            ) : (
              banks.map((bank) => (
                <div key={bank.id} className="rounded border border-dashed p-3 text-sm">
                  <p>
                    <strong>Banka:</strong> {bank.bankName}
                  </p>
                  <p>
                    <strong>Hesap sahibi:</strong> {bank.accountName}
                  </p>
                  <p className="font-mono">
                    <strong>IBAN:</strong> {bank.iban}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => void copyIban(bank.iban)}
                  >
                    {copiedIban === bank.iban ? "Kopyalandı" : "IBAN Kopyala"}
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Geri
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Devam
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Sipariş özeti</h2>
          <ul className="space-y-2 text-sm">
            {cartQuery.data?.items.map((item, index) => (
              <li key={index}>
                {item.product.name} × {item.quantity} — {item.subtotal}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Kupon kodunuz"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="max-w-xs uppercase"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void validateCoupon()}
            >
              Uygula
            </Button>
          </div>
          {couponMessage ? (
            <p className="text-sm text-slate-600">{couponMessage}</p>
          ) : null}
          {couponDiscount ? (
            <p className="text-sm text-emerald-700">
              Kupon indirimi (sunucu): {couponDiscount} TRY
            </p>
          ) : null}
          <p className="font-semibold">
            Toplam: {cartQuery.data?.summary.total}{" "}
            {cartQuery.data?.summary.currency}
          </p>
          <p className="text-sm text-slate-600">Ödeme: Havale / EFT</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Geri
            </Button>
            <Button
              type="button"
              disabled={creating}
              onClick={() => void placeOrder()}
            >
              {creating ? "Oluşturuluyor…" : "Siparişi Oluştur"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
