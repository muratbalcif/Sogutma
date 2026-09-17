"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        const value = q.trim();
        if (!value) return;
        router.push(`/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <label className="sr-only" htmlFor="site-search">
        Ürün ara
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
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
        id="site-search"
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Ürün, marka veya SKU ara…"
        autoComplete="off"
        className="pl-10"
      />
    </form>
  );
}
