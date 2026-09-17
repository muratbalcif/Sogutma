"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient, clientApiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";
import type { AuthUser } from "@/types/api";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => authClient.me() as Promise<AuthUser>,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      clientApiFetch<AuthUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
        }),
      }),
    onSuccess: (updated) => {
      setMessage("Profil güncellendi.");
      setError(null);
      queryClient.setQueryData(["me"], updated);
    },
    onError: (err: unknown) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Profil güncellenemedi");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Ayarlar
      </h1>

      {isLoading ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded border bg-white p-4 text-sm"
        >
          <p className="text-slate-500">{user?.email}</p>
          <p className="text-slate-500">Tip: {user?.userType}</p>

          <label className="block">
            <span className="text-slate-500">Ad</span>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Soyad</span>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Telefon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="+90555..."
            />
          </label>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded bg-navy px-4 py-2 text-white disabled:opacity-50"
          >
            {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
          </button>

          {message ? (
            <p className="text-emerald-700">{message}</p>
          ) : null}
          {error ? <p className="text-red-700">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
