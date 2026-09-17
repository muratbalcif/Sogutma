"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authStorage } from "@/lib/auth-storage";
import { isAdminUser } from "@/lib/permissions";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = authStorage.getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    const profile = await authService.me();
    authStorage.setSession(
      authStorage.getAccessToken() ?? "",
      authStorage.getRefreshToken() ?? "",
      profile,
    );
    setUser(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = authStorage.getUser();
        const token = authStorage.getAccessToken();
        if (!token) {
          if (!cancelled) setUser(null);
          return;
        }
        if (cached && !cancelled) setUser(cached);
        const profile = await authService.me();
        if (!cancelled) {
          authStorage.setSession(
            authStorage.getAccessToken() ?? token,
            authStorage.getRefreshToken() ?? "",
            profile,
          );
          setUser(profile);
        }
      } catch {
        authStorage.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (!isAdminUser(result.user)) {
      authStorage.clear();
      throw new Error(
        "Bu hesap admin paneline erişemez. Admin rolü gerekli.",
      );
    }
    authStorage.setSession(
      result.accessToken,
      result.refreshToken,
      result.user,
    );
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = authStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Always clear local session
    } finally {
      authStorage.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user && authStorage.getAccessToken()),
      isAdmin: isAdminUser(user),
      login,
      logout,
      refreshProfile,
    }),
    [user, loading, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
