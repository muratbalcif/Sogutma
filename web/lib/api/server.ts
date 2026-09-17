import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api/base";

export const ACCESS_COOKIE = "fs_access_token";
export const REFRESH_COOKIE = "fs_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function serverApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  return apiFetch<T>(path, { ...init, accessToken: token });
}
