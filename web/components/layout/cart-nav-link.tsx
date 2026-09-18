"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clientApiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/base";
import { cartItemCount, formatCartTotal, type CartSummary } from "@/lib/cart";
import clsx from "clsx";

type Props = {
  className?: string;
  onNavigate?: () => void;
  compact?: boolean;
};

export function CartNavLink({ className, onNavigate, compact }: Props) {
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      try {
        return await clientApiFetch<CartSummary>("/cart");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 15_000,
  });

  const cart = cartQuery.data;
  const count = cart ? cartItemCount(cart) : 0;
  const totalLabel = cart && count > 0 ? formatCartTotal(cart) : null;

  return (
    <Link
      href="/cart"
      onClick={onNavigate}
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] font-semibold transition",
        count > 0
          ? "bg-primary-light text-primary-dark"
          : "text-text-secondary hover:bg-primary-soft hover:text-primary",
        className,
      )}
      aria-label={
        count > 0
          ? `Sepet, ${count} ürün${totalLabel ? `, ${totalLabel}` : ""}`
          : "Sepet"
      }
    >
      <span>Sepet</span>
      {count > 0 ? (
        <>
          <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
          {!compact && totalLabel ? (
            <span className="text-xs font-medium text-primary-dark/80">
              {totalLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}
