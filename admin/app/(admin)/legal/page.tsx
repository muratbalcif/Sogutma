"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/auth/module-page";
import { ApiError } from "@/lib/api-client";
import { legalAdminService } from "@/services/admin-api.service";

const SLUGS = [
  { slug: "kvkk", label: "KVKK" },
  { slug: "privacy", label: "Gizlilik" },
  { slug: "terms", label: "Kullanım koşulları" },
] as const;

type Slug = (typeof SLUGS)[number]["slug"];

export default function LegalAdminPage() {
  const [slug, setSlug] = useState<Slug>("kvkk");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const pageQuery = useQuery({
    queryKey: ["admin-legal", slug],
    queryFn: () => legalAdminService.get(slug),
  });

  useEffect(() => {
    if (!pageQuery.data) return;
    setTitle(pageQuery.data.title);
    setBody(pageQuery.data.body);
    setMessage(null);
    setError(null);
  }, [pageQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; body: string }) =>
      legalAdminService.update(slug, payload),
    onSuccess: (updated) => {
      setTitle(updated.title);
      setBody(updated.body);
      setMessage("Kaydedildi.");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-legal", slug] });
    },
    onError: (err: unknown) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({ title: title.trim(), body: body.trim() });
  }

  return (
    <ModulePage permission={["site.read", "site.update"]}>
      <div className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Yasal metinler
          </h2>
          <p className="text-sm text-slate-500">
            Web ve mobil uygulamada yayınlanan KVKK, gizlilik ve kullanım
            koşulları. Değişiklikler API üzerinden anında yansır.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SLUGS.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => setSlug(item.slug)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                slug === item.slug
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {pageQuery.isLoading ? (
          <p className="text-slate-600">Yükleniyor…</p>
        ) : pageQuery.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {pageQuery.error instanceof ApiError
              ? pageQuery.error.message
              : "Metin alınamadı"}
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <label className="block text-sm">
              <span className="text-slate-500">Başlık</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">İçerik</span>
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={22}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </button>
              {pageQuery.data?.updatedAt ? (
                <span className="text-xs text-slate-500">
                  Son güncelleme:{" "}
                  {new Date(pageQuery.data.updatedAt).toLocaleString("tr-TR")}
                </span>
              ) : null}
            </div>
            {message ? (
              <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </form>
        )}
      </div>
    </ModulePage>
  );
}
