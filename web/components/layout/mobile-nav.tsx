"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CartNavLink } from "@/components/layout/cart-nav-link";
import { NavLink } from "@/components/layout/nav-link";
import type { CategoryNode } from "@/types/api";

export function MobileNav({ categories }: { categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
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
      {open ? (
        <div
          id="mobile-menu"
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-80 bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-5 font-[family-name:var(--font-display)] text-lg font-semibold text-primary">
              Menü
            </p>
            <nav className="flex flex-col gap-1">
              <NavLink href="/account" exact onClick={() => setOpen(false)}>
                Hesabım
              </NavLink>
              <NavLink
                href="/account/favorites"
                onClick={() => setOpen(false)}
              >
                Favoriler
              </NavLink>
              <CartNavLink onNavigate={() => setOpen(false)} />
              <NavLink href="/products" onClick={() => setOpen(false)}>
                Ürünler
              </NavLink>
              <NavLink href="/campaigns" onClick={() => setOpen(false)}>
                Kampanyalar
              </NavLink>
              <hr className="my-3 border-border" />
              {categories.map((cat) => (
                <NavLink
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  onClick={() => setOpen(false)}
                >
                  {cat.name}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
