import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ProductGrid } from "@/components/ui/product-card";
import {
  ProductFiltersDesktopSuspense,
  ProductFiltersMobileSuspense,
} from "@/components/catalog/product-filters-suspense";
import { catalogService } from "@/services/catalog.service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Ürünler",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const keys = [
    "category",
    "brand",
    "minPrice",
    "maxPrice",
    "sort",
    "page",
    "inStock",
    "onCampaign",
    "search",
  ];
  for (const key of keys) {
    const value = pick(params[key]);
    if (value) query.set(key, value);
  }
  if (!query.get("page")) query.set("page", "1");
  if (!query.get("limit")) query.set("limit", "20");

  const [products, brands, categories] = await Promise.all([
    catalogService.products(query.toString()).catch(() => ({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })),
    catalogService.brands().catch(() => []),
    catalogService.categories().catch(() => []),
  ]);

  const makeHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/products?${next.toString()}`;
  };

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Ana Sayfa", href: "/" }, { label: "Ürünler" }]}
      />
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground md:mb-6 md:text-3xl">
        Ürünler
      </h1>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
        <div className="hidden lg:block">
          <ProductFiltersDesktopSuspense
            brands={brands}
            categories={categories}
          />
        </div>

        <div>
          <ProductFiltersMobileSuspense
            brands={brands}
            categories={categories}
            total={products.meta.total}
          />

          <p className="mb-4 hidden text-sm text-text-secondary lg:block">
            {products.meta.total} ürün
          </p>

          {products.items.length === 0 ? (
            <EmptyState
              title="Ürün bulunamadı"
              description="Filtreleri değiştirerek tekrar deneyin."
              actionHref="/products"
              actionLabel="Filtreleri temizle"
            />
          ) : (
            <>
              <ProductGrid products={products.items} />
              <Pagination
                page={products.meta.page}
                totalPages={products.meta.totalPages}
                makeHref={makeHref}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
