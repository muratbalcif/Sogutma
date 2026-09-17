import type { LegalPage } from "@/services/legal.service";

export function LegalDocument({ page }: { page: LegalPage }) {
  const paragraphs = page.body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        {page.title}
      </h1>
      <p className="mt-2 text-xs text-slate-500">
        Son güncelleme: {new Date(page.updatedAt).toLocaleString("tr-TR")}
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    </main>
  );
}
