import { Suspense } from "react";
import { ProductFilters } from "@/components/catalog/product-filters";

export function ProductFiltersSuspense({
  brands,
  categories,
}: {
  brands: Array<{ id: string; name: string; slug: string }>;
  categories: Parameters<typeof ProductFilters>[0]["categories"];
}) {
  return (
    <Suspense fallback={<aside className="rounded border bg-white p-4">Filtreler…</aside>}>
      <ProductFilters brands={brands} categories={categories} />
    </Suspense>
  );
}
