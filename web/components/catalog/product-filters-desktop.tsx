"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CategoryNode } from "@/types/api";
import {
  SORT_OPTIONS,
  flattenCategories,
  filtersFromSearchParams,
  type ProductFilterValues,
} from "@/components/catalog/product-filter-utils";

const fieldClassName =
  "w-full min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ProductFiltersDesktop({
  brands,
  categories,
}: {
  brands: Array<{ id: string; name: string; slug: string }>;
  categories: CategoryNode[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flatCategories = flattenCategories(categories);
  const filters = filtersFromSearchParams(searchParams);
  const sort = searchParams.get("sort") ?? "newest";

  function push(next: Partial<ProductFilterValues> & { sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...filters, ...next };
    const setOrDelete = (key: string, value: string) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    };
    setOrDelete("category", merged.category);
    setOrDelete("brand", merged.brand);
    setOrDelete("minPrice", merged.minPrice);
    setOrDelete("maxPrice", merged.maxPrice);
    setOrDelete("inStock", merged.inStock ? "true" : "");
    setOrDelete("onCampaign", merged.onCampaign ? "true" : "");
    if (next.sort !== undefined) {
      if (!next.sort) params.delete("sort");
      else params.set("sort", next.sort);
    }
    params.set("page", "1");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <aside className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="desktop-sort">
          Sıralama
        </label>
        <select
          id="desktop-sort"
          className={fieldClassName}
          value={sort}
          onChange={(event) => push({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="desktop-category">
          Kategori
        </label>
        <select
          id="desktop-category"
          className={fieldClassName}
          value={filters.category}
          onChange={(event) => push({ category: event.target.value })}
        >
          <option value="">Tümü</option>
          {flatCategories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {`${"— ".repeat(cat.depth)}${cat.name}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="desktop-brand">
          Marka
        </label>
        <select
          id="desktop-brand"
          className={fieldClassName}
          value={filters.brand}
          onChange={(event) => push({ brand: event.target.value })}
        >
          <option value="">Tümü</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="desktop-min">
            Min
          </label>
          <input
            id="desktop-min"
            inputMode="decimal"
            className={fieldClassName}
            defaultValue={filters.minPrice}
            key={`min-${filters.minPrice}`}
            onBlur={(event) => push({ minPrice: event.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="desktop-max">
            Max
          </label>
          <input
            id="desktop-max"
            inputMode="decimal"
            className={fieldClassName}
            defaultValue={filters.maxPrice}
            key={`max-${filters.maxPrice}`}
            onBlur={(event) => push({ maxPrice: event.target.value })}
          />
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-base font-medium text-foreground">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={filters.inStock}
          onChange={(event) => push({ inStock: event.target.checked })}
        />
        Stokta olanlar
      </label>
      <label className="flex min-h-11 items-center gap-3 text-base font-medium text-foreground">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={filters.onCampaign}
          onChange={(event) => push({ onCampaign: event.target.checked })}
        />
        Kampanyalı
      </label>
    </aside>
  );
}
