"use client";

import { useAuth } from "@/hooks/use-auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  return {
    permissions,
    roles,
    can: (code: string | string[]) => hasPermission(permissions, code, roles),
    canAny: (codes: string[]) => hasAnyPermission(permissions, codes, roles),
  };
}
