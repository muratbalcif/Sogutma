import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { catalogService } from "@/services/catalog.service";
import { resolveProductImageSrc } from "@/lib/product-image";
import type { CategoryNode } from "@/types/api";

export const metadata: Metadata = {
  title: "Kategoriler",
  description: "İhtiyacınıza uygun klima ve soğutma ürünlerini keşfedin.",
  alternates: { canonical: "/categories" },
};

function categoryLabel(cat: CategoryNode): string {
  const name = cat.name?.trim();
  if (name) return name;
  const slug = cat.slug?.trim();
  if (slug) return slug.replace(/-/g, " ");
  return "Kategori";
}

function CategoryIcon({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-xl font-bold text-primary-dark"
    >
      {label.slice(0, 1).toLocaleUpperCase("tr-TR")}
    </span>
  );
}

function CategoryCard({ category }: { category: CategoryNode }) {
  const label = categoryLabel(category);
  const rawImage = category.image?.trim() || null;
  const imageSrc = rawImage ? resolveProductImageSrc(rawImage) : null;
  const hasImage = Boolean(imageSrc && imageSrc !== "/images/product-placeholder.svg");

  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_12px_28px_rgba(15,118,110,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[16/10] bg-surface-secondary">
        {hasImage && imageSrc ? (
          <Image
            src={imageSrc}
            alt={label}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CategoryIcon label={label} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 text-[17px] font-semibold leading-snug text-foreground md:text-lg">
          {label}
        </h2>
        <span className="mt-auto text-sm font-semibold text-primary transition group-hover:text-primary-dark">
          Klimayı keşfet →
        </span>
      </div>
    </Link>
  );
}

function CategoryError() {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Kategoriler yüklenemedi
      </h2>
      <p className="mt-2 text-sm text-text-secondary">Tekrar deneyin</p>
      <Link
        href="/categories"
        className="mt-5 inline-flex rounded-[11px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
      >
        Tekrar Dene
      </Link>
    </div>
  );
}

function CategoryEmpty() {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Henüz kategori bulunmuyor
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        Kategoriler yakında burada listelenecek.
      </p>
    </div>
  );
}

export default async function CategoriesPage() {
  let categories: CategoryNode[] = [];
  let failed = false;
  try {
    categories = await catalogService.categories();
  } catch {
    failed = true;
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <div>
        <Breadcrumb
          items={[
            { label: "Ana Sayfa", href: "/" },
            { label: "Kategoriler" },
          ]}
        />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Kategoriler
        </h1>
        <p className="mt-2 max-w-2xl text-base text-text-secondary">
          İhtiyacınıza uygun klima ve soğutma ürünlerini keşfedin.
        </p>
      </div>

      <section className="grid overflow-hidden rounded-2xl bg-primary-light md:grid-cols-2">
        <div className="flex flex-col justify-center gap-3 p-6 md:p-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-primary-dark md:text-3xl">
            Kategorileri Keşfedin
          </h2>
          <p className="max-w-md text-sm text-text-secondary md:text-base">
            İşletmeniz ve eviniz için doğru soğutma çözümünü bulun.
          </p>
        </div>
        <div className="relative min-h-[140px] bg-primary/10 md:min-h-[200px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/70 text-3xl font-bold text-primary shadow-sm">
              FS
            </div>
          </div>
        </div>
      </section>

      {failed ? (
        <CategoryError />
      ) : categories.length === 0 ? (
        <CategoryEmpty />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
