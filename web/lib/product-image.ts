/**
 * Seed catalog uses a non-resolving placeholder CDN host.
 * Map those URLs to a local asset so next/image never tries to optimize them.
 */
const PLACEHOLDER = "/images/product-placeholder.svg";

export function resolveProductImageSrc(url: string | null | undefined): string {
  if (!url) return PLACEHOLDER;
  try {
    const { hostname } = new URL(url);
    if (hostname === "cdn.furkansogutma.local") return PLACEHOLDER;
    return url;
  } catch {
    return PLACEHOLDER;
  }
}
