import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ProductGrid } from "@/components/ui/product-card";
import { SearchForm } from "@/components/layout/search-form";
import { catalogService } from "@/services/catalog.service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return {
    title: q ? `Arama: ${q}` : "Arama",
    alternates: { canonical: q ? `/search?q=${encodeURIComponent(q)}` : "/search" },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const page = Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? "1");

  const results = q
    ? await catalogService.search(q, page).catch(() => ({
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }))
    : null;

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl text-navy">
        Arama
      </h1>
      <div className="mb-6 max-w-xl">
        <SearchForm defaultQuery={q} />
      </div>
      {!q ? (
        <EmptyState title="Aramak için bir ifade girin" />
      ) : results && results.items.length === 0 ? (
        <EmptyState title={`“${q}” için sonuç yok`} />
      ) : results ? (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {results.meta.total} sonuç
          </p>
          <ProductGrid products={results.items} />
          <Pagination
            page={results.meta.page}
            totalPages={results.meta.totalPages}
            makeHref={(p) => `/search?q=${encodeURIComponent(q)}&page=${p}`}
          />
        </>
      ) : null}
    </div>
  );
}
