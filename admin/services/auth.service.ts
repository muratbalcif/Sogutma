import { apiRequest } from "@/lib/api-client";
import type { AuthTokensResponse, AuthUser } from "@/types/api";

export const authService = {
  login(email: string, password: string): Promise<AuthTokensResponse> {
    return apiRequest<AuthTokensResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
  },

  me(): Promise<AuthUser> {
    return apiRequest<AuthUser>("/auth/me");
  },

  logout(refreshToken: string): Promise<{ success: true }> {
    return apiRequest<{ success: true }>("/auth/logout", {
      method: "POST",
      auth: false,
      body: { refreshToken },
    });
  },
};
