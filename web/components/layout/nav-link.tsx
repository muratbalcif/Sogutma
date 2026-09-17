"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({
  href,
  children,
  className,
  onClick,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "rounded-xl px-3.5 py-2 text-[15px] font-semibold transition",
        active
          ? "bg-primary-light text-primary-dark"
          : "text-text-secondary hover:bg-[#F0FDFA] hover:text-primary",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
