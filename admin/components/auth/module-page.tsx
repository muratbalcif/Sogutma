"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export function ModulePage({
  permission,
  children,
}: {
  permission?: string | string[];
  children: ReactNode;
}) {
  const { can } = usePermissions();

  if (permission && !can(permission)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Bu sayfa için yetkiniz yok.
      </div>
    );
  }

  return <>{children}</>;
}
