import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/base";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import type { AuthUser } from "@/types/api";

type AuthPayload = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string; password: string };
    const data = await apiFetch<AuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const response = NextResponse.json({ user: data.user });
    setAuthCookies(response, data.accessToken, data.refreshToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status = error && typeof error === "object" && "status" in error
      ? Number((error as { status: number }).status)
      : 401;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
