import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-[13px] border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted",
        "transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}
