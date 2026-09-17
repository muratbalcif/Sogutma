import Link from "next/link";
import { SearchForm } from "@/components/layout/search-form";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { CategoryNode } from "@/types/api";

function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  const result: CategoryNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenCategories(node.children));
    }
  }
  return result;
}

export function SiteHeader({
  categories,
  siteName,
}: {
  categories: CategoryNode[];
  siteName: string;
}) {
  const flat = flattenCategories(categories).slice(0, 8);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
          {siteName}
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchForm />
        </div>
        <nav className="ml-auto hidden items-center gap-4 text-sm font-medium text-slate-700 md:flex">
          <Link href="/account" className="hover:text-accent">
            Hesabım
          </Link>
          <Link href="/account/favorites" className="hover:text-accent">
            Favoriler
          </Link>
          <Link href="/cart" className="hover:text-accent">
            Sepet
          </Link>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/cart" className="rounded-md border px-3 py-2 text-sm">
            Sepet
          </Link>
          <MobileNav categories={flat} />
        </div>
      </div>
      <div className="border-t border-slate-100 bg-navy">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-2 text-sm text-cyan-50">
          <Link href="/products" className="whitespace-nowrap font-semibold">
            Tüm Kategoriler
          </Link>
          <Link href="/campaigns" className="whitespace-nowrap opacity-90 hover:opacity-100">
            Kampanyalar
          </Link>
          {flat.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="whitespace-nowrap opacity-90 hover:opacity-100"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-2 md:hidden">
        <SearchForm />
      </div>
    </header>
  );
}
