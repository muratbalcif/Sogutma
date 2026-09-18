/**
 * Public API base (browser / build-time NEXT_PUBLIC_*).
 * Safe to reference from client code if needed.
 */
export function getPublicApiBaseUrl(): string {
  return normalizeBase(
    process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:3000/api/v1",
  );
}

/**
 * Server-side API base (RSC, Route Handlers, BFF proxy).
 * Prefer INTERNAL_API_BASE_URL (Docker service DNS) so SSR does not hairpin
 * through the public HTTPS edge. Never import this from Client Components.
 */
export function getServerApiBaseUrl(): string {
  const internal = process.env.INTERNAL_API_BASE_URL?.trim();
  if (internal) return normalizeBase(internal);
  return getPublicApiBaseUrl();
}

function normalizeBase(url: string): string {
  return url.replace(/\/$/, "");
}
