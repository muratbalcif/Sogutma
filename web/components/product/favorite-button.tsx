"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";

export function FavoriteButton({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      if (active) {
        await clientApiFetch(`/favorites/${productId}`, { method: "DELETE" });
        setActive(false);
      } else {
        await clientApiFetch(`/favorites/${productId}`, { method: "POST" });
        setActive(true);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/login?next=/products/${productSlug}`);
        return;
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      disabled={pending}
      onClick={(event) => void toggle(event)}
      className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-muted shadow-sm transition hover:text-error disabled:opacity-60"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className={active ? "text-error" : undefined}
      >
        <path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.4-7 10-7 10z" />
      </svg>
    </button>
  );
}
