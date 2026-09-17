import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ProductGrid } from "@/components/ui/product-card";
import { catalogService } from "@/services/catalog.service";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const category = await catalogService.category(slug);
    return {
      title: category.name,
      alternates: { canonical: `/categories/${slug}` },
    };
  } catch {
    return { title: "Kategori" };
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "1";

  let category;
  try {
    category = await catalogService.category(slug);
  } catch {
    notFound();
  }

  const products = await catalogService
    .products(`category=${slug}&page=${page}&limit=20`)
    .catch(() => ({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "/" },
      { "@type": "ListItem", position: 2, name: category.name },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <Breadcrumb
        items={[
          { label: "Ana Sayfa", href: "/" },
          { label: category.name },
        ]}
      />
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-3xl text-navy">
        {category.name}
      </h1>
      {products.items.length === 0 ? (
        <EmptyState title="Bu kategoride ürün yok" actionHref="/products" actionLabel="Tüm ürünler" />
      ) : (
        <>
          <ProductGrid products={products.items} />
          <Pagination
            page={products.meta.page}
            totalPages={products.meta.totalPages}
            makeHref={(p) => `/categories/${slug}?page=${p}`}
          />
        </>
      )}
    </div>
  );
}
