import { apiRequest, authStorage } from "./client";
import { canDiscount, canRefund, canUsePos } from "./permissions";
import type { AuthTokensResponse, AuthUser } from "../types/api";

export { canDiscount, canRefund, canUsePos };

export async function login(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  const result = await apiRequest<AuthTokensResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  authStorage.setSession(result.accessToken, result.refreshToken, result.user);
  return result;
}

export async function fetchMe(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me");
}

export async function logout(): Promise<void> {
  const refreshToken = authStorage.getRefreshToken();
  try {
    if (refreshToken) {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      });
    }
  } finally {
    authStorage.clear();
  }
}
