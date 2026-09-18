import { Suspense } from "react";
import { ProductFiltersDesktop } from "@/components/catalog/product-filters-desktop";
import { ProductFiltersMobile } from "@/components/catalog/product-filters-mobile";
import type { CategoryNode } from "@/types/api";

type Brand = { id: string; name: string; slug: string };

export function ProductFiltersDesktopSuspense({
  brands,
  categories,
}: {
  brands: Brand[];
  categories: CategoryNode[];
}) {
  return (
    <Suspense
      fallback={
        <aside className="rounded-2xl border border-border bg-surface p-5">
          Filtreler…
        </aside>
      }
    >
      <ProductFiltersDesktop brands={brands} categories={categories} />
    </Suspense>
  );
}

export function ProductFiltersMobileSuspense({
  brands,
  categories,
  total,
}: {
  brands: Brand[];
  categories: CategoryNode[];
  total: number;
}) {
  return (
    <Suspense
      fallback={
        <div className="mb-4 space-y-3">
          <div className="h-11 animate-pulse rounded-xl bg-surface-secondary" />
          <div className="flex gap-2">
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-surface-secondary" />
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-surface-secondary" />
          </div>
        </div>
      }
    >
      <ProductFiltersMobile
        brands={brands}
        categories={categories}
        total={total}
      />
    </Suspense>
  );
}
