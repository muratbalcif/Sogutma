"use client";

import { useAuth } from "@/hooks/use-auth";

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium text-slate-800">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-slate-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
