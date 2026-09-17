"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  children: ReactNode;
  permission?: string | string[];
};

export function RequireAuth({ children, permission }: Props) {
  const router = useRouter();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { can } = usePermissions();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isAdmin) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Oturum doğrulanıyor…
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (permission && !can(permission)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Bu sayfa için yetkiniz yok.
      </div>
    );
  }

  return <>{children}</>;
}
