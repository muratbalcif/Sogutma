"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { clientApiFetch } from "@/lib/api/client";
import { useState } from "react";

type Address = {
  id: string;
  title: string;
  city: string;
  district: string;
  addressLine: string;
  isDefault: boolean;
};

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["addresses"],
    queryFn: () => clientApiFetch<Address[]>("/addresses"),
  });
  const [form, setForm] = useState({
    title: "Ev",
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    district: "",
    addressLine: "",
    isDefault: false,
  });

  const create = useMutation({
    mutationFn: () =>
      clientApiFetch("/addresses", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      clientApiFetch(`/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Adreslerim
      </h1>
      {!query.data?.length ? (
        <EmptyState title="Kayıtlı adres yok" />
      ) : (
        <ul className="space-y-2">
          {query.data.map((address) => (
            <li key={address.id} className="rounded border bg-white p-3 text-sm">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {address.title}
                    {address.isDefault ? " · Varsayılan" : ""}
                  </p>
                  <p>
                    {address.addressLine}, {address.district}/{address.city}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(address.id)}
                >
                  Sil
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-2 rounded border bg-white p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Input
          placeholder="Başlık"
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
        />
        <Input
          placeholder="Ad"
          value={form.firstName}
          onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
        />
        <Input
          placeholder="Soyad"
          value={form.lastName}
          onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
        />
        <Input
          placeholder="Telefon"
          value={form.phone}
          onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
        />
        <Input
          placeholder="Şehir"
          value={form.city}
          onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
        />
        <Input
          placeholder="İlçe"
          value={form.district}
          onChange={(e) => setForm((s) => ({ ...s, district: e.target.value }))}
        />
        <Input
          className="sm:col-span-2"
          placeholder="Adres"
          value={form.addressLine}
          onChange={(e) =>
            setForm((s) => ({ ...s, addressLine: e.target.value }))
          }
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) =>
              setForm((s) => ({ ...s, isDefault: e.target.checked }))
            }
          />
          Varsayılan adres
        </label>
        <Button type="submit" className="sm:col-span-2">
          Adres ekle
        </Button>
      </form>
    </div>
  );
}
