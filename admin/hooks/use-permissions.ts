"use client";

import { useAuth } from "@/hooks/use-auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return {
    permissions,
    roles: user?.roles ?? [],
    can: (code: string | string[]) => hasPermission(permissions, code),
    canAny: (codes: string[]) => hasAnyPermission(permissions, codes),
  };
}
