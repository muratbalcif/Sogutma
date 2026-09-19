export function hasPermission(
  permissions: string[] | undefined,
  required: string | string[],
  roles?: string[],
): boolean {
  if (roles?.includes("SUPER_ADMIN")) return true;
  if (!permissions || permissions.length === 0) return false;
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((code) => permissions.includes(code));
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  required: string[],
  roles?: string[],
): boolean {
  return hasPermission(permissions, required, roles);
}

export function isAdminUser(user: {
  roles?: string[];
  permissions?: string[];
} | null): boolean {
  if (!user) return false;
  return (user.roles?.length ?? 0) > 0 || (user.permissions?.length ?? 0) > 0;
}
