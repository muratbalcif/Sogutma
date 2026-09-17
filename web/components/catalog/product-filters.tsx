"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CategoryNode } from "@/types/api";

export function ProductFilters({
  brands,
  categories,
}: {
  brands: Array<{ id: string; name: string; slug: string }>;
  categories: CategoryNode[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    params.set("page", "1");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="sort">
          Sıralama
        </label>
        <select
          id="sort"
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          defaultValue={searchParams.get("sort") ?? "newest"}
          onChange={(event) => update("sort", event.target.value)}
        >
          <option value="recommended">Önerilen</option>
          <option value="newest">Yeni ürünler</option>
          <option value="price_asc">En düşük fiyat</option>
          <option value="price_desc">En yüksek fiyat</option>
          <option value="best_selling">Çok satanlar</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="category">
          Kategori
        </label>
        <select
          id="category"
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          defaultValue={searchParams.get("category") ?? ""}
          onChange={(event) => update("category", event.target.value)}
        >
          <option value="">Tümü</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="brand">
          Marka
        </label>
        <select
          id="brand"
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          defaultValue={searchParams.get("brand") ?? ""}
          onChange={(event) => update("brand", event.target.value)}
        >
          <option value="">Tümü</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="minPrice">
            Min
          </label>
          <input
            id="minPrice"
            className="w-full rounded-md border px-2 py-2 text-sm"
            defaultValue={searchParams.get("minPrice") ?? ""}
            onBlur={(event) => update("minPrice", event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="maxPrice">
            Max
          </label>
          <input
            id="maxPrice"
            className="w-full rounded-md border px-2 py-2 text-sm"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            onBlur={(event) => update("maxPrice", event.target.value)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          defaultChecked={searchParams.get("inStock") === "true"}
          onChange={(event) =>
            update("inStock", event.target.checked ? "true" : "")
          }
        />
        Stokta olanlar
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          defaultChecked={searchParams.get("onCampaign") === "true"}
          onChange={(event) =>
            update("onCampaign", event.target.checked ? "true" : "")
          }
        />
        Kampanyalı
      </label>
    </aside>
  );
}
