import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api/base";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
} from "@/lib/auth/cookies";

async function refreshAccess(): Promise<string | null> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const response = await fetch(`${getApiUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  return JSON.stringify(data);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, "POST");
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, "DELETE");
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string,
) {
  const { path } = await context.params;
  const targetPath = `/${path.join("/")}${request.nextUrl.search}`;
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await request.text();

  const doFetch = (token?: string) =>
    fetch(`${getApiUrl()}${targetPath}`, {
      method,
      headers: {
        Accept: request.headers.get("Accept") ?? "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

  let upstream = await doFetch(access);
  let setCookiePayload: string | null = null;

  if (upstream.status === 401) {
    setCookiePayload = await refreshAccess();
    if (setCookiePayload) {
      const tokens = JSON.parse(setCookiePayload) as {
        accessToken: string;
        refreshToken: string;
      };
      access = tokens.accessToken;
      upstream = await doFetch(access);
      const buffer = await upstream.arrayBuffer();
      const response = new NextResponse(buffer, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("Content-Type") ?? "application/octet-stream",
        },
      });
      const disposition = upstream.headers.get("Content-Disposition");
      if (disposition) response.headers.set("Content-Disposition", disposition);
      setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
      return response;
    }
  }

  const buffer = await upstream.arrayBuffer();
  const response = new NextResponse(buffer, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) response.headers.set("Content-Disposition", disposition);
  return response;
}
