import type { AuthUser } from "@/types/api";

const ACCESS_KEY = "fs_admin_access_token";
const REFRESH_KEY = "fs_admin_refresh_token";
const USER_KEY = "fs_admin_user";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export const authStorage = {
  getAccessToken(): string | null {
    if (!canUseStorage()) return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken(): string | null {
    if (!canUseStorage()) return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  getUser(): AuthUser | null {
    if (!canUseStorage()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setSession(accessToken: string, refreshToken: string, user: AuthUser): void {
    if (!canUseStorage()) return;
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    if (!canUseStorage()) return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
