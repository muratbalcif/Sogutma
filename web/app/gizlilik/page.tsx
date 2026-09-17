export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-navy">
        Gizlilik Politikası
      </h1>
      <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
        LEGAL CONTENT REQUIRED — Bu sayfa hukuki metin içermez. Yayın öncesi
        yetkili hukuk danışmanı tarafından hazırlanmış gizlilik metni
        yerleştirilmelidir.
      </p>
      <p className="mt-6 text-slate-600 text-sm">
        Teknik veri envanteri için dahili doküman:{" "}
        <code>docs/privacy-data-map.md</code>
      </p>
    </main>
  );
}
