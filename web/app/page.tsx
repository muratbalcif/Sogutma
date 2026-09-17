import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/ui/product-card";
import { catalogService } from "@/services/catalog.service";

export const metadata: Metadata = {
  title: "Ana Sayfa",
  description: "FurkanSoğutma soğutma ve iklimlendirme ürünleri",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [banners, categories, featured, campaigns, bestSelling, brands] =
    await Promise.all([
      catalogService.banners().catch(() => []),
      catalogService.categories().catch(() => []),
      catalogService.featured().catch(() => []),
      catalogService.campaignProducts().catch(() => []),
      catalogService.bestSelling().catch(() => []),
      catalogService.brands().catch(() => []),
    ]);

  const hero = banners[0];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-xl bg-navy text-white">
        {hero ? (
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[280px]">
              <Image
                src={hero.imageUrl}
                alt={hero.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width:768px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                FurkanSoğutma
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold md:text-4xl">
                {hero.title}
              </h1>
              {hero.subtitle ? (
                <p className="mt-3 text-slate-200">{hero.subtitle}</p>
              ) : null}
              <Link
                href={
                  hero.linkType === "CATEGORY" && hero.linkValue
                    ? `/categories/${hero.linkValue}`
                    : hero.linkType === "PRODUCT" && hero.linkValue
                      ? `/products/${hero.linkValue}`
                      : hero.linkType === "URL" && hero.linkValue
                        ? hero.linkValue
                        : "/products"
                }
                className="mt-6 inline-flex w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold"
              >
                İncele
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-10">
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold">
              FurkanSoğutma
            </h1>
            <p className="mt-3 max-w-xl text-slate-200">
              Profesyonel soğutma ve iklimlendirme çözümleri.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold"
            >
              Ürünlere göz at
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-navy">
          Kategoriler
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.slice(0, 8).map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-accent"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
              Öne Çıkan Ürünler
            </h2>
            <Link href="/products?sort=recommended" className="text-sm text-accent">
              Tümü
            </Link>
          </div>
          <ProductGrid products={featured} />
        </section>
      ) : null}

      {campaigns.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
              Kampanyalı Ürünler
            </h2>
            <Link href="/campaigns" className="text-sm text-accent hover:underline">
              Tüm kampanyalar
            </Link>
          </div>
          <ProductGrid products={campaigns} />
        </section>
      ) : null}

      {bestSelling.length > 0 ? (
        <section>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-navy">
            Çok Satanlar
          </h2>
          <ProductGrid products={bestSelling} />
        </section>
      ) : null}

      {brands.length > 0 ? (
        <section>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-navy">
            Markalar
          </h2>
          <div className="flex flex-wrap gap-3">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/products?brand=${brand.slug}`}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3">
        {[
          ["Orijinal ürün", "Yetkili ve güvenilir tedarik"],
          ["Hızlı sevkiyat", "Stoktan hızlı hazırlık"],
          ["Teknik destek", "Uzman ekip ile satış sonrası destek"],
        ].map(([title, text]) => (
          <div key={title}>
            <h3 className="font-semibold text-navy">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
