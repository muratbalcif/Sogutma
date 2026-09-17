import Link from "next/link";
import type { CategoryNode, SiteConfig } from "@/types/api";

export function SiteFooter({
  config,
  categories,
}: {
  config: SiteConfig;
  categories: CategoryNode[];
}) {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-navy text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg text-white">
            {config.siteName}
          </p>
          <p className="mt-2 text-sm text-slate-300">{config.address}</p>
          <p className="mt-2 text-sm">{config.supportPhone}</p>
          <p className="text-sm">{config.supportEmail}</p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Kurumsal</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href={config.privacyUrl}>Gizlilik</Link>
            </li>
            <li>
              <Link href={config.kvkkUrl}>KVKK</Link>
            </li>
            <li>
              <Link href={config.termsUrl}>Kullanım koşulları</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Kategoriler</p>
          <ul className="space-y-2 text-sm">
            {categories.slice(0, 6).map((cat) => (
              <li key={cat.id}>
                <Link href={`/categories/${cat.slug}`}>{cat.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Hesabım</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/account">Hesabım</Link>
            </li>
            <li>
              <Link href="/account/orders">Siparişler</Link>
            </li>
            <li>
              <Link href="/login">Giriş</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
