"use client";

import { ApiError } from "@/lib/api/base";

async function bffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: string }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

/** Authenticated browser calls go through BFF so tokens stay HttpOnly. */
export async function clientApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return bffFetch<T>(`/api/proxy${path}`, init);
}

export const authClient = {
  login(email: string, password: string) {
    return bffFetch<{ user: unknown }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  register(body: Record<string, unknown>) {
    return bffFetch<{ user: unknown }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  forgotPassword(email: string) {
    return bffFetch<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  logout() {
    return bffFetch<{ success: true }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return bffFetch("/api/auth/me");
  },
};

/** Authenticated CSV/text download via BFF (HttpOnly cookies). */
export async function clientApiDownload(
  path: string,
  filename: string,
): Promise<void> {
  const response = await fetch(`/api/proxy${path}`, {
    credentials: "same-origin",
    headers: { Accept: "text/csv, text/plain, application/json, */*" },
  });
  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) message = data.message.join(", ");
      else if (data.message) message = data.message;
    } catch {
      // keep default
    }
    throw new ApiError(response.status, message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
