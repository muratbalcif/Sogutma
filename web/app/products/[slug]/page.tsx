import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Price } from "@/components/ui/price";
import { ProductActions } from "@/components/product/product-actions";
import { catalogService } from "@/services/catalog.service";
import type { ProductDetail } from "@/types/api";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = (await catalogService.product(slug)) as ProductDetail;
    return {
      title: product.name,
      description: product.description ?? product.name,
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: {
        title: product.name,
        description: product.description ?? undefined,
        images: product.images[0] ? [{ url: product.images[0].url }] : [],
      },
    };
  } catch {
    return { title: "Ürün bulunamadı" };
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  let product: ProductDetail;
  try {
    product = (await catalogService.product(slug)) as ProductDetail;
  } catch {
    notFound();
  }

  const primary =
    product.images.find((image) => image.isPrimary) ?? product.images[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: product.brand.name,
    image: product.images.map((image) => image.url),
    offers: product.price
      ? {
          "@type": "Offer",
          priceCurrency: product.price.currency,
          price: product.price.amount,
          availability: product.stock?.available
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        }
      : undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: `/categories/${product.category.slug}`,
      },
      { "@type": "ListItem", position: 3, name: product.name },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <Breadcrumb
        items={[
          { label: "Ana Sayfa", href: "/" },
          {
            label: product.category.name,
            href: `/categories/${product.category.slug}`,
          },
          { label: product.name },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
            {primary ? (
              <Image
                src={primary.url}
                alt={primary.alt ?? product.name}
                fill
                priority
                className="object-contain p-6"
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {product.images.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-square rounded border bg-white"
                >
                  <Image
                    src={image.url}
                    alt={image.alt ?? product.name}
                    fill
                    className="object-contain p-1"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            {product.brand.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-navy">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">SKU: {product.sku}</p>
          {product.barcode ? (
            <p className="text-sm text-slate-500">Barkod: {product.barcode}</p>
          ) : null}
          <div className="mt-4">
            {product.price ? (
              <Price
                amount={product.price.amount}
                currency={product.price.currency}
                compareAt={product.compareAtPrice?.amount}
              />
            ) : (
              <p className="text-slate-600">Fiyat bilgisi yok</p>
            )}
          </div>
          <p className="mt-2 text-sm">
            {product.stock?.available
              ? `Stokta · ${product.stock.quantity} adet`
              : "Stokta yok"}
          </p>
          <ProductActions product={product} />
          {product.description ? (
            <div className="mt-8">
              <h2 className="font-semibold text-navy">Açıklama</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {product.description}
              </p>
            </div>
          ) : null}
          {product.attributes.length > 0 ? (
            <div className="mt-8">
              <h2 className="font-semibold text-navy">Teknik özellikler</h2>
              <dl className="mt-2 divide-y rounded border bg-white">
                {product.attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="grid grid-cols-2 gap-2 px-3 py-2 text-sm"
                  >
                    <dt className="text-slate-500">{attr.name}</dt>
                    <dd>{attr.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {product.compatibility.length > 0 ? (
            <div className="mt-8">
              <h2 className="font-semibold text-navy">Uyumluluk</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {product.compatibility.map((item) => (
                  <li key={item.id}>
                    {item.manufacturer} {item.model}
                    {item.modelYear ? ` (${item.modelYear})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-8 rounded border border-dashed p-4 text-sm text-slate-600">
            Henüz yorum bulunmuyor.
          </div>
        </div>
      </div>
    </div>
  );
}
