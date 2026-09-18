import type { CategoryNode } from "@/types/api";

export type ProductFilterValues = {
  category: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  onCampaign: boolean;
};

export type FlatCategory = {
  id: string;
  name: string;
  slug: string;
  depth: number;
};

export const SORT_OPTIONS = [
  { value: "recommended", label: "Önerilen" },
  { value: "newest", label: "Yeni ürünler" },
  { value: "price_asc", label: "En düşük fiyat" },
  { value: "price_desc", label: "En yüksek fiyat" },
  { value: "best_selling", label: "Çok satanlar" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      depth,
    });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return result;
}

export function emptyFilters(): ProductFilterValues {
  return {
    category: "",
    brand: "",
    minPrice: "",
    maxPrice: "",
    inStock: false,
    onCampaign: false,
  };
}

export function filtersFromSearchParams(
  params: URLSearchParams,
): ProductFilterValues {
  return {
    category: params.get("category") ?? "",
    brand: params.get("brand") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    inStock: params.get("inStock") === "true",
    onCampaign: params.get("onCampaign") === "true",
  };
}

export function countActiveFilters(filters: ProductFilterValues): number {
  let count = 0;
  if (filters.category) count += 1;
  if (filters.brand) count += 1;
  if (filters.minPrice) count += 1;
  if (filters.maxPrice) count += 1;
  if (filters.inStock) count += 1;
  if (filters.onCampaign) count += 1;
  return count;
}

export function sortLabel(value: string): string {
  return SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Sırala";
}

export type ActiveFilterChip = {
  key: keyof ProductFilterValues | "search";
  label: string;
};

export function buildActiveFilterChips({
  filters,
  search,
  categories,
  brands,
}: {
  filters: ProductFilterValues;
  search: string;
  categories: FlatCategory[];
  brands: Array<{ name: string; slug: string }>;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (search.trim()) {
    chips.push({ key: "search", label: `"${search.trim()}"` });
  }
  if (filters.category) {
    const cat = categories.find((item) => item.slug === filters.category);
    chips.push({ key: "category", label: cat?.name ?? filters.category });
  }
  if (filters.brand) {
    const brand = brands.find((item) => item.slug === filters.brand);
    chips.push({ key: "brand", label: brand?.name ?? filters.brand });
  }
  if (filters.minPrice) {
    chips.push({ key: "minPrice", label: `Min ${filters.minPrice}` });
  }
  if (filters.maxPrice) {
    chips.push({ key: "maxPrice", label: `Max ${filters.maxPrice}` });
  }
  if (filters.inStock) {
    chips.push({ key: "inStock", label: "Stokta" });
  }
  if (filters.onCampaign) {
    chips.push({ key: "onCampaign", label: "Kampanyalı" });
  }
  return chips;
}

export function applyFiltersToParams(
  current: URLSearchParams,
  filters: ProductFilterValues,
  extras?: { sort?: string; search?: string | null },
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  const setOrDelete = (key: string, value: string) => {
    if (!value) params.delete(key);
    else params.set(key, value);
  };

  setOrDelete("category", filters.category);
  setOrDelete("brand", filters.brand);
  setOrDelete("minPrice", filters.minPrice);
  setOrDelete("maxPrice", filters.maxPrice);
  setOrDelete("inStock", filters.inStock ? "true" : "");
  setOrDelete("onCampaign", filters.onCampaign ? "true" : "");

  if (extras?.sort !== undefined) {
    if (!extras.sort) params.delete("sort");
    else params.set("sort", extras.sort);
  }
  if (extras && "search" in extras) {
    const search = extras.search?.trim() ?? "";
    setOrDelete("search", search);
  }

  params.set("page", "1");
  return params;
}
