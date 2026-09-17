import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/base";
import { clearAuthCookies } from "@/lib/auth/cookies";

export async function POST() {
  const jar = await cookies();
  const refresh = jar.get("fs_refresh_token")?.value;
  if (refresh) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      // ignore
    }
  }
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
