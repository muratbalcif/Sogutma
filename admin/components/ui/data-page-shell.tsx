"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api-client";

type Props<T> = {
  title: string;
  permission: string | string[];
  queryKey: string[];
  queryFn: () => Promise<T>;
  children: (data: T) => ReactNode;
  emptyMessage?: string;
};

export function DataPageShell<T>({
  title,
  permission,
  queryKey,
  queryFn,
  children,
  emptyMessage = "Kayıt bulunamadı.",
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
      ) : data === undefined || data === null ? (
        <p className="text-slate-600">{emptyMessage}</p>
      ) : (
        children(data)
      )}

      <p className="sr-only">{title}</p>
    </div>
  );
}
