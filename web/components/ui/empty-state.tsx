import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-[11px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
