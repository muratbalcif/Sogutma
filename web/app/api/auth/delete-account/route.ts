import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ApiError, apiFetch } from "@/lib/api/base";
import { ACCESS_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (!access) {
    return NextResponse.json({ message: "Giriş yapın" }, { status: 401 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    password = "";
  }

  try {
    await apiFetch<{ success: true }>("/auth/account/delete", {
      method: "POST",
      accessToken: access,
      body: JSON.stringify({ password }),
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError ? error.message : "Hesap silinemedi";
    return NextResponse.json({ message }, { status });
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
