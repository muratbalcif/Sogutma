import { serverApiFetch } from "@/lib/api/server";
import type {
  Banner,
  CampaignSummary,
  CategoryNode,
  Paginated,
  ProductListItem,
  SiteConfig,
} from "@/types/api";

export const catalogService = {
  categories: () => serverApiFetch<CategoryNode[]>("/categories"),
  category: (slug: string) =>
    serverApiFetch<{ id: string; name: string; slug: string; description?: string | null }>(
      `/categories/${slug}`,
    ),
  brands: () =>
    serverApiFetch<Array<{ id: string; name: string; slug: string; logo: string | null }>>(
      "/brands",
    ),
  banners: () => serverApiFetch<Banner[]>("/banners"),
  campaigns: () => serverApiFetch<CampaignSummary[]>("/campaigns"),
  siteConfig: () => serverApiFetch<SiteConfig>("/site/config"),
  products: (query: string) =>
    serverApiFetch<Paginated<ProductListItem>>(`/products?${query}`),
  featured: () => serverApiFetch<ProductListItem[]>("/products/featured"),
  bestSelling: () =>
    serverApiFetch<ProductListItem[]>("/products/best-selling"),
  campaignProducts: () =>
    serverApiFetch<ProductListItem[]>("/products/campaigns"),
  product: (slug: string) =>
    serverApiFetch(`/products/${encodeURIComponent(slug)}`),
  search: (q: string, page = 1) =>
    serverApiFetch<Paginated<ProductListItem>>(
      `/products/search?q=${encodeURIComponent(q)}&page=${page}&limit=20`,
    ),
};
