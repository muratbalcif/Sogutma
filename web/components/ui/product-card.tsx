import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { FavoriteButton } from "@/components/product/favorite-button";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { resolveProductImageSrc } from "@/lib/product-image";
import type { ProductListItem } from "@/types/api";

export function ProductCard({ product }: { product: ProductListItem }) {
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const inStock = Boolean(product.stock?.available);
  const imageSrc = resolveProductImageSrc(image?.url);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square bg-surface-secondary"
      >
        {image ? (
          <Image
            src={imageSrc}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Görsel yok
          </div>
        )}
        {product.onCampaign ? (
          <span className="absolute left-2 top-2">
            <Badge tone="accent">Kampanya</Badge>
          </span>
        ) : null}
        <FavoriteButton productId={product.id} productSlug={product.slug} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {product.brand.name}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-foreground hover:text-primary"
        >
          {product.name}
        </Link>
        {product.price ? (
          <Price
            amount={product.price.amount}
            currency={product.price.currency}
            compareAt={product.compareAtPrice?.amount}
          />
        ) : (
          <p className="text-sm text-text-secondary">Fiyat için giriş yapın</p>
        )}
        <p
          className={
            inStock
              ? "text-xs font-medium text-success"
              : "text-xs font-medium text-error"
          }
        >
          {inStock ? `Stokta (${product.stock?.quantity})` : "Stokta yok"}
        </p>
        <AddToCartButton
          className="mt-auto pt-1"
          productId={product.id}
          productSlug={product.slug}
          available={inStock}
        />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
