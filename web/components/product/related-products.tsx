import { Suspense } from "react";
import { ProductGrid } from "@/components/ui/product-card";
import { catalogService } from "@/services/catalog.service";

async function RelatedProductsList({ slug }: { slug: string }) {
  let related: Awaited<ReturnType<typeof catalogService.related>> = [];
  let error: string | null = null;
  try {
    related = await catalogService.related(slug);
  } catch (err) {
    error = err instanceof Error ? err.message : "İlgili ürünler yüklenemedi";
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (related.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Bu ürün için ilgili ürün bulunmuyor.
      </p>
    );
  }

  return <ProductGrid products={related} />;
}

function RelatedProductsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-lg border bg-slate-100"
        />
      ))}
    </div>
  );
}

export function RelatedProductsSection({ slug }: { slug: string }) {
  return (
    <section className="mt-12 space-y-4 border-t pt-8">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
        İlgili ürünler
      </h2>
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProductsList slug={slug} />
      </Suspense>
    </section>
  );
}
