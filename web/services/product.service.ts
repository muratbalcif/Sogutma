import { catalogService } from "./catalog.service";

export const productService = {
  list: (query: string) => catalogService.products(query),
  bySlug: (slug: string) => catalogService.product(slug),
  search: (q: string, page?: number) => catalogService.search(q, page),
  featured: () => catalogService.featured(),
  bestSelling: () => catalogService.bestSelling(),
  campaigns: () => catalogService.campaignProducts(),
};
