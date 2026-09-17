import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Sayfalama">
      {page > 1 ? (
        <Link className="rounded border px-3 py-1.5 text-sm" href={makeHref(page - 1)}>
          Önceki
        </Link>
      ) : null}
      <span className="text-sm text-slate-600">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="rounded border px-3 py-1.5 text-sm" href={makeHref(page + 1)}>
          Sonraki
        </Link>
      ) : null}
    </nav>
  );
}
