export default function CampaignsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border bg-slate-50"
          />
        ))}
      </div>
    </div>
  );
}
