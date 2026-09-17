import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/base";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/cookies";
import type { AuthUser } from "@/types/api";

export async function GET() {
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;

  try {
    if (!access && refresh) {
      const rotated = await apiFetch<{
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
      }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: refresh }),
      });
      access = rotated.accessToken;
      const user = await apiFetch<AuthUser>("/auth/me", {
        accessToken: access,
      });
      const response = NextResponse.json(user);
      setAuthCookies(response, rotated.accessToken, rotated.refreshToken);
      return response;
    }
    if (!access) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const user = await apiFetch<AuthUser>("/auth/me", { accessToken: access });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}
