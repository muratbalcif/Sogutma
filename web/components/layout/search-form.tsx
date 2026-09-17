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
      className="w-full"
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
      <Input
        id="site-search"
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Ürün, marka veya SKU ara…"
        autoComplete="off"
      />
    </form>
  );
}
