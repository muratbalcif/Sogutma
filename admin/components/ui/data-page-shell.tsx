"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";

type Props<T> = {
  title: string;
  permission: string | string[];
  queryKey: string[];
  queryFn: () => Promise<T>;
  children: (data: T) => ReactNode;
  emptyMessage?: string;
  isEmpty?: (data: T) => boolean;
};

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return false;
}

export function DataPageShell<T>({
  title,
  permission,
  queryKey,
  queryFn,
  children,
  emptyMessage = "Kayıt bulunamadı.",
  isEmpty = defaultIsEmpty as (data: T) => boolean,
}: Props<T>) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Veri kaynağı: canlı API · yetki:{" "}
          {Array.isArray(permission) ? permission.join(", ") : permission}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {isFetching ? "Yenileniyor…" : "Yenile"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Yükleniyor…</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof ApiError
            ? error.message
            : "Veri alınamadı. API erişimini kontrol edin."}
        </div>
      ) : data === undefined || data === null || isEmpty(data) ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="font-medium text-slate-800">{emptyMessage}</p>
          <p className="mt-1 text-sm text-slate-500">
            Filtreleri değiştirin veya yeni kayıt ekleyin.
          </p>
        </div>
      ) : (
        children(data)
      )}

      <p className="sr-only">{title}</p>
    </div>
  );
}
