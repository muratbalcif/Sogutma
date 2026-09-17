import { authClient, clientApiFetch } from "@/lib/api/client";

export const authService = {
  login: authClient.login,
  register: authClient.register,
  logout: authClient.logout,
  me: authClient.me,
  refresh: () =>
    clientApiFetch<{ success: boolean }>("/auth/refresh", { method: "POST" }),
};
