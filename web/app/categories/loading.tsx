export default function CategoriesLoading() {
  return (
    <div className="space-y-8 md:space-y-10" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-secondary" />
        <div className="h-10 w-56 animate-pulse rounded bg-surface-secondary" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-secondary" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-primary-light/60 md:h-48" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <div className="aspect-[16/10] animate-pulse bg-surface-secondary" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-surface-secondary" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-surface-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
