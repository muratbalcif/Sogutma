type Props = {
  label: string;
  value: number | string | null;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-slate-900">
        {value === null
          ? "—"
          : typeof value === "number"
            ? value.toLocaleString("tr-TR")
            : value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
      {value === null ? (
        <p className="mt-1 text-xs text-amber-700">
          Yetki yok veya endpoint yanıt vermedi
        </p>
      ) : null}
    </div>
  );
}
