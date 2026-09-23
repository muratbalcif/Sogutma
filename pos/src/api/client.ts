import type { ApiErrorBody, AuthTokensResponse, AuthUser } from "../types/api";
import {
  ApiError,
  configurePosHttp,
  friendlyErrorMessage,
  type PosRequestOptions,
} from "./http";

export { ApiError, configurePosHttp, friendlyErrorMessage };

const ACCESS_KEY = "fs_pos_access";
const REFRESH_KEY = "fs_pos_refresh";
const USER_KEY = "fs_pos_user";

export const authStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setSession(accessToken: string, refreshToken: string, user: AuthUser) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base =
    configured ||
    (import.meta.env.DEV ? "http://localhost:3000/api/v1" : "");
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not configured for this build");
  }
  return base.replace(/\/$/, "");
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      authStorage.clear();
      return false;
    }
    const data = (await response.json()) as AuthTokensResponse;
    authStorage.setSession(data.accessToken, data.refreshToken, data.user);
    return true;
  } catch {
    authStorage.clear();
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function parseErrorMessage(status: number, body: ApiErrorBody | null): string {
  const raw = body?.message;
  const msg = Array.isArray(raw) ? raw.join(", ") : raw;
  if (msg && typeof msg === "string") return msg;
  if (status === 401) return "Oturum süresi doldu. Tekrar giriş yapın.";
  if (status === 403) return "Bu işlem için yetkiniz bulunmuyor.";
  if (status === 0) return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
  return `İstek başarısız (${status})`;
}

/** Default HTTP client for the Tauri / Vite POS shell. */
export async function apiRequest<T>(
  path: string,
  options: PosRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, signal, headers: extra } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = authStorage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch {
    throw new ApiError(0, "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.", null);
  }

  if (response.status === 401 && auth) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      const token = authStorage.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        response = await doFetch();
      } catch {
        throw new ApiError(0, "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.", null);
      }
    }
  }

  if (!response.ok) {
    let bodyJson: ApiErrorBody | null = null;
    try {
      bodyJson = (await response.json()) as ApiErrorBody;
    } catch {
      bodyJson = null;
    }
    throw new ApiError(
      response.status,
      parseErrorMessage(response.status, bodyJson),
      bodyJson,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Call once at Tauri/Vite boot so POS API modules use this client. */
export function installDefaultPosHttp(): void {
  configurePosHttp(apiRequest);
}
