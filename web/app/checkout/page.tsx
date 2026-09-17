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

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "CREDIT_CARD"
  >("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: "Ev",
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    district: "",
    addressLine: "",
  });

  const addressesQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: () => clientApiFetch<Address[]>("/addresses"),
  });
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => clientApiFetch<Cart>("/cart"),
  });

  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);

  async function saveAddress() {
    const created = await clientApiFetch<Address>("/addresses", {
      method: "POST",
      body: JSON.stringify(newAddress),
    });
    await addressesQuery.refetch();
    setShippingAddressId(created.id);
    setBillingAddressId(created.id);
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
          }),
        },
      );
      await clientApiFetch(`/orders/${order.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ method: paymentMethod }),
      });
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
          <label className="flex gap-2 text-sm">
            <input
              type="radio"
              checked={paymentMethod === "BANK_TRANSFER"}
              onChange={() => setPaymentMethod("BANK_TRANSFER")}
            />
            Havale / EFT
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="radio"
              checked={paymentMethod === "CREDIT_CARD"}
              onChange={() => setPaymentMethod("CREDIT_CARD")}
            />
            Online ödeme (kart bilgisi saklanmaz)
          </label>
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
          <p className="font-semibold">
            Toplam: {cartQuery.data?.summary.total}{" "}
            {cartQuery.data?.summary.currency}
          </p>
          <p className="text-sm text-slate-600">Ödeme: {paymentMethod}</p>
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
