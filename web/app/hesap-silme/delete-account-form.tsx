"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";
import type { AuthUser } from "@/types/api";

export function DeleteAccountForm() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => authClient.me() as Promise<AuthUser>,
    retry: false,
  });
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Hesap silinemedi");
        return;
      }
      window.location.href = "/?hesap=silindi";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hesap silinemedi");
    } finally {
      setPending(false);
    }
  }

  if (me.isLoading) {
    return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  }

  if (me.isError || !me.data) {
    return (
      <Link
        href="/login?next=/hesap-silme"
        className="inline-flex rounded-[11px] bg-primary px-5 py-2.5 text-sm font-semibold text-white"
      >
        Giriş yap ve hesabı sil
      </Link>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-600">
        Giriş yapan hesap: <span className="font-medium">{me.data.email}</span>
      </p>
      <label className="block text-sm">
        <span className="text-slate-500">Şifre</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1"
        />
        <span>
          Hesabımın kapatılmasını ve kişisel bilgilerimin silinmesini onaylıyorum.
        </span>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !confirmed || password.length < 8}
        className="rounded-[11px] bg-red-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Siliniyor…" : "Hesabımı sil"}
      </button>
    </form>
  );
}
