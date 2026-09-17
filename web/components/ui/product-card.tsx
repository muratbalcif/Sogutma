import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import type { ProductListItem } from "@/types/api";

export function ProductCard({ product }: { product: ProductListItem }) {
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0];
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-slate-50">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-contain p-4 transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Görsel yok
          </div>
        )}
        {product.onCampaign ? (
          <span className="absolute left-2 top-2">
            <Badge tone="accent">Kampanya</Badge>
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {product.brand.name}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-sm font-medium text-navy hover:text-accent"
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
          <p className="text-sm text-slate-500">Fiyat için giriş yapın</p>
        )}
        <p className="mt-auto text-xs text-slate-500">
          {product.stock?.available
            ? `Stokta (${product.stock.quantity})`
            : "Stokta yok"}
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
