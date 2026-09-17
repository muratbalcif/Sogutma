"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export default function SettingsPage() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => authClient.me() as Promise<AuthUser>,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Ayarlar
      </h1>
      <div className="rounded border bg-white p-4 text-sm">
        <p>
          {user?.firstName} {user?.lastName}
        </p>
        <p>{user?.email}</p>
        <p className="text-slate-500">{user?.phone ?? "Telefon yok"}</p>
        <p className="mt-2 text-slate-500">Tip: {user?.userType}</p>
      </div>
    </div>
  );
}
