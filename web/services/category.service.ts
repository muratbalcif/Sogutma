import { catalogService } from "./catalog.service";

export const categoryService = {
  list: () => catalogService.categories(),
  bySlug: (slug: string) => catalogService.category(slug),
};
