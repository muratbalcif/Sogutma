"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
            className="absolute right-0 top-0 h-full w-72 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-4 font-semibold text-navy">Menü</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/account" onClick={() => setOpen(false)}>
                Hesabım
              </Link>
              <Link href="/account/favorites" onClick={() => setOpen(false)}>
                Favoriler
              </Link>
              <Link href="/cart" onClick={() => setOpen(false)}>
                Sepet
              </Link>
              <Link href="/products" onClick={() => setOpen(false)}>
                Ürünler
              </Link>
              <Link href="/campaigns" onClick={() => setOpen(false)}>
                Kampanyalar
              </Link>
              <hr className="my-2" />
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  onClick={() => setOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
