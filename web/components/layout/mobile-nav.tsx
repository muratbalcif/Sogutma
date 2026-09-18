"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CartNavLink } from "@/components/layout/cart-nav-link";
import { NavLink } from "@/components/layout/nav-link";
import type { CategoryNode } from "@/types/api";

export function MobileNav({ categories }: { categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open ? (
    <div
      id="mobile-menu"
      className="fixed inset-0 z-[100] bg-black/40"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        className="absolute inset-y-0 left-0 flex h-full w-[min(20rem,88vw)] flex-col bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary">
            Menü
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-text-secondary hover:bg-primary-soft hover:text-primary"
            aria-label="Menüyü kapat"
          >
            Kapat
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          <NavLink href="/account" exact onClick={() => setOpen(false)}>
            Hesabım
          </NavLink>
          <NavLink href="/account/favorites" onClick={() => setOpen(false)}>
            Favoriler
          </NavLink>
          <CartNavLink onNavigate={() => setOpen(false)} />
          <NavLink href="/products" onClick={() => setOpen(false)}>
            Ürünler
          </NavLink>
          <NavLink href="/campaigns" onClick={() => setOpen(false)}>
            Kampanyalar
          </NavLink>
          <NavLink href="/categories" onClick={() => setOpen(false)}>
            Tüm Kategoriler
          </NavLink>
          {categories.length > 0 ? (
            <>
              <hr className="my-3 border-border" />
              <p className="px-3.5 pb-1 text-xs font-semibold uppercase tracking-wide text-text-faint">
                Kategoriler
              </p>
              {categories.map((cat) => (
                <NavLink
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  onClick={() => setOpen(false)}
                  className="truncate"
                >
                  {cat.name}
                </NavLink>
              ))}
            </>
          ) : null}
        </nav>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        Menü
      </Button>
      {mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
