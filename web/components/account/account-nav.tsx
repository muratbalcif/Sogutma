"use client";

import Link from "next/link";
import { authClient } from "@/lib/api/client";

const links = [
  { href: "/account", label: "Hesabım" },
  { href: "/account/orders", label: "Siparişlerim" },
  { href: "/account/favorites", label: "Favorilerim" },
  { href: "/account/addresses", label: "Adreslerim" },
  { href: "/account/alerts", label: "Stok Bildirimlerim" },
  { href: "/account/comments", label: "Yorumlarım" },
  { href: "/account/current-account", label: "Cari Hesabım" },
  { href: "/account/bank-transfers", label: "Havale Bildirimlerim" },
  { href: "/account/settings", label: "Ayarlar" },
];

export function AccountNav() {
  return (
    <aside className="rounded-lg border bg-white p-4">
      <nav className="flex flex-col gap-2 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-accent">
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          className="mt-2 text-left text-red-600"
          onClick={() => {
            void authClient.logout().then(() => {
              window.location.href = "/";
            });
          }}
        >
          Çıkış
        </button>
      </nav>
    </aside>
  );
}
