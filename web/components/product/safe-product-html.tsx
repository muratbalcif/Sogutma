import { sanitizeProductHtml } from "@/lib/sanitize-product-html";

const proseClass =
  "product-rich-html text-sm text-slate-700 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--color-text)] [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[var(--color-border)] [&_th]:bg-[var(--color-primary-light)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_a]:text-[var(--color-primary)] [&_a]:underline";

export function SafeProductHtml({ html }: { html: string }) {
  const clean = sanitizeProductHtml(html);
  if (!clean) return null;
  return (
    <div
      className={proseClass}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
