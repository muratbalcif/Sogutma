"use client";

export type ProductCompatibilityRow = {
  manufacturer: string;
  model: string;
  modelYear: string;
  notes: string;
};

type ProductCompatibilityEditorProps = {
  value: ProductCompatibilityRow[];
  onChange: (next: ProductCompatibilityRow[]) => void;
};

const emptyRow = (): ProductCompatibilityRow => ({
  manufacturer: "",
  model: "",
  modelYear: "",
  notes: "",
});

export function ProductCompatibilityEditor({
  value,
  onChange,
}: ProductCompatibilityEditorProps) {
  function updateRow(index: number, patch: Partial<ProductCompatibilityRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...value, emptyRow()]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Uyumluluk</h3>
        <p className="text-xs text-slate-500">
          Marka ve model zorunludur. Model yılı ve notlar opsiyoneldir.
        </p>
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
          Henüz uyumluluk kaydı yok.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((row, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kayıt {index + 1}
                </p>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                  onClick={() => remove(index)}
                  aria-label={`Uyumluluk kaydı ${index + 1} sil`}
                >
                  Sil
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  Marka
                  <input
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Örn. Daikin"
                    value={row.manufacturer}
                    onChange={(e) =>
                      updateRow(index, { manufacturer: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Model
                  <input
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Örn. FTXM50"
                    value={row.model}
                    onChange={(e) => updateRow(index, { model: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Model yılı
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Örn. 2024"
                    inputMode="numeric"
                    value={row.modelYear}
                    onChange={(e) =>
                      updateRow(index, { modelYear: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Notlar
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Opsiyonel not"
                    value={row.notes}
                    onChange={(e) => updateRow(index, { notes: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        onClick={add}
      >
        + Uyumluluk Ekle
      </button>
    </div>
  );
}

export function compatibilityToPayload(rows: ProductCompatibilityRow[]) {
  return rows
    .map((row) => ({
      manufacturer: row.manufacturer.trim(),
      model: row.model.trim(),
      modelYear: row.modelYear.trim(),
      notes: row.notes.trim(),
    }))
    .filter((row) => row.manufacturer && row.model)
    .map((row) => ({
      manufacturer: row.manufacturer,
      model: row.model,
      modelYear: row.modelYear ? Number(row.modelYear) : undefined,
      notes: row.notes || undefined,
    }));
}
