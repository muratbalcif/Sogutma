import { cookies } from "next/headers";
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
    const body = await request.json();
    const data = await apiFetch<AuthPayload>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const response = NextResponse.json({ user: data.user });
    setAuthCookies(response, data.accessToken, data.refreshToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Register failed";
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function GET() {
  // noop for typing
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  const refresh = jar.get("fs_refresh_token")?.value;
  if (refresh) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      // clear anyway
    }
  }
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
