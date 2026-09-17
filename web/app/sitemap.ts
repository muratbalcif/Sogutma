import type { MetadataRoute } from "next";
import { catalogService } from "@/services/catalog.service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const staticRoutes = ["", "/products", "/search", "/login", "/register"].map(
    (path) => ({
      url: `${site}${path}`,
      lastModified: new Date(),
    }),
  );

  try {
    const [categories, products] = await Promise.all([
      catalogService.categories(),
      catalogService.products("page=1&limit=100"),
    ]);
    return [
      ...staticRoutes,
      ...categories.map((cat) => ({
        url: `${site}/categories/${cat.slug}`,
        lastModified: new Date(),
      })),
      ...products.items.map((product) => ({
        url: `${site}/products/${product.slug}`,
        lastModified: new Date(),
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
