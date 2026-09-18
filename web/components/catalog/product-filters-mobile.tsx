"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import type { CategoryNode } from "@/types/api";
import {
  SORT_OPTIONS,
  applyFiltersToParams,
  buildActiveFilterChips,
  countActiveFilters,
  emptyFilters,
  flattenCategories,
  filtersFromSearchParams,
  sortLabel,
  type ProductFilterValues,
} from "@/components/catalog/product-filter-utils";

const fieldClassName =
  "w-full min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ProductFiltersMobile({
  brands,
  categories,
  total,
}: {
  brands: Array<{ id: string; name: string; slug: string }>;
  categories: CategoryNode[];
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const applied = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search") ?? "";
  const activeCount = countActiveFilters(applied);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState<ProductFilterValues>(applied);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    if (filtersOpen) setDraft(applied);
  }, [filtersOpen, applied]);

  const chips = useMemo(
    () =>
      buildActiveFilterChips({
        filters: applied,
        search,
        categories: flatCategories,
        brands,
      }),
    [applied, search, flatCategories, brands],
  );

  const navigate = useCallback(
    (params: URLSearchParams) => {
      router.push(`/products?${params.toString()}`);
    },
    [router],
  );

  function removeChip(key: ActiveChipKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "search") params.delete("search");
    else if (key === "inStock" || key === "onCampaign") params.delete(key);
    else params.delete(key);
    params.set("page", "1");
    navigate(params);
  }

  function applyDraft() {
    const params = applyFiltersToParams(searchParams, draft);
    navigate(params);
    setFiltersOpen(false);
  }

  function clearAllAndApply() {
    setDraft(emptyFilters());
    const params = applyFiltersToParams(searchParams, emptyFilters());
    navigate(params);
    setFiltersOpen(false);
  }

  function applySort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.set("page", "1");
    navigate(params);
    setSortOpen(false);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const value = searchDraft.trim();
    if (!value) params.delete("search");
    else params.set("search", value);
    params.set("page", "1");
    navigate(params);
  }

  return (
    <div className="mb-4 space-y-3 lg:hidden">
      <form role="search" onSubmit={submitSearch} className="relative">
        <label className="sr-only" htmlFor="products-search">
          Ürün ara
        </label>
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path
              d="M20 20l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <Input
          id="products-search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Ürün, marka veya SKU ara…"
          autoComplete="off"
          className="min-h-11 pl-10"
        />
      </form>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground"
        >
          <FilterIcon />
          {activeCount > 0 ? `Filtreler (${activeCount})` : "Filtreler"}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground"
        >
          <SortIcon />
          <span className="truncate">
            Sırala: {sortLabel(sort).replace(" ürünler", "")}
          </span>
        </button>
      </div>

      {chips.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeChip(chip.key)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary-light px-3 text-sm font-semibold text-primary-dark"
            >
              <span className="max-w-[10rem] truncate">{chip.label}</span>
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
              <span className="sr-only">{chip.label} filtresini kaldır</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
          Ürünler
        </h2>
        <p className="text-sm text-text-secondary">{total} ürün</p>
      </div>

      <BottomSheet
        open={filtersOpen}
        title="Filtreler"
        onClose={() => setFiltersOpen(false)}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={clearAllAndApply}
            >
              Temizle
            </Button>
            <Button type="button" className="min-h-11" onClick={applyDraft}>
              Ürünleri Göster
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="mobile-category">
              Kategori
            </label>
            <select
              id="mobile-category"
              className={fieldClassName}
              value={draft.category}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, category: event.target.value }))
              }
            >
              <option value="">Tümü</option>
              {flatCategories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {`${"— ".repeat(cat.depth)}${cat.name}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="mobile-brand">
              Marka
            </label>
            <select
              id="mobile-brand"
              className={fieldClassName}
              value={draft.brand}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, brand: event.target.value }))
              }
            >
              <option value="">Tümü</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="mobile-min">
                Min fiyat
              </label>
              <input
                id="mobile-min"
                inputMode="decimal"
                className={fieldClassName}
                value={draft.minPrice}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, minPrice: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="mobile-max">
                Max fiyat
              </label>
              <input
                id="mobile-max"
                inputMode="decimal"
                className={fieldClassName}
                value={draft.maxPrice}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, maxPrice: event.target.value }))
                }
              />
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={draft.inStock}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, inStock: event.target.checked }))
              }
            />
            Stokta olanlar
          </label>
          <label className="flex min-h-11 items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={draft.onCampaign}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  onCampaign: event.target.checked,
                }))
              }
            />
            Kampanyalı
          </label>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sortOpen}
        title="Sıralama"
        onClose={() => setSortOpen(false)}
      >
        <div className="space-y-1">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => applySort(option.value)}
              className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base font-medium transition ${
                sort === option.value
                  ? "bg-primary text-white"
                  : "text-foreground hover:bg-surface-secondary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

type ActiveChipKey = ReturnType<typeof buildActiveFilterChips>[number]["key"];

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6v12M8 18l-3-3M8 18l3-3M16 18V6M16 6l-3 3M16 6l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
