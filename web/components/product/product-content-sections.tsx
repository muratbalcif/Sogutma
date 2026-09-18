"use client";

import { useState, type ReactNode } from "react";

type AccordionItemProps = {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function AccordionItem({ title, open, onToggle, children }: AccordionItemProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="font-semibold text-[var(--color-text)]">{title}</span>
        <span
          className={`text-[var(--color-primary)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type ProductContentSectionsProps = {
  attributes: Array<{ id: string; name: string; value: string }>;
  compatibility: Array<{
    id: string;
    manufacturer: string;
    model: string;
    modelYear: number | null;
    notes: string | null;
  }>;
  technicalHtml?: string | null;
  compatibilityHtml?: string | null;
  technicalRich: ReactNode;
  compatibilityRich: ReactNode;
};

export function ProductContentSections({
  attributes,
  compatibility,
  technicalRich,
  compatibilityRich,
}: ProductContentSectionsProps) {
  const [open, setOpen] = useState<string | null>("technical");

  const toggle = (id: string) =>
    setOpen((current) => (current === id ? null : id));

  const hasTechnicalRows = attributes.length > 0;
  const hasTechnicalHtml = Boolean(technicalRich);
  const hasCompatibilityRows = compatibility.length > 0;
  const hasCompatibilityHtml = Boolean(compatibilityRich);

  return (
    <div className="mt-8 space-y-3">
      <AccordionItem
        id="technical"
        title="Teknik Özellikler"
        open={open === "technical"}
        onToggle={() => toggle("technical")}
      >
        {hasTechnicalRows ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="min-w-full text-sm">
              <tbody>
                {attributes.map((attr, i) => (
                  <tr
                    key={attr.id}
                    className={
                      i % 2 === 0
                        ? "bg-[var(--color-surface)]"
                        : "bg-[var(--color-background)]"
                    }
                  >
                    <th
                      scope="row"
                      className="w-[40%] px-3 py-2.5 text-left font-medium text-[var(--color-secondary)]"
                    >
                      {attr.name}
                    </th>
                    <td className="px-3 py-2.5 text-[var(--color-text)]">
                      {attr.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasTechnicalHtml ? (
          <div className={hasTechnicalRows ? "mt-4" : undefined}>
            {technicalRich}
          </div>
        ) : null}

        {!hasTechnicalRows && !hasTechnicalHtml ? (
          <p className="text-sm text-[var(--color-secondary)]">
            Bu ürün için teknik özellik bulunmuyor.
          </p>
        ) : null}
      </AccordionItem>

      <AccordionItem
        id="compatibility"
        title="Uyumluluk"
        open={open === "compatibility"}
        onToggle={() => toggle("compatibility")}
      >
        {hasCompatibilityRows ? (
          <ul className="space-y-2">
            {compatibility.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-[var(--color-text)]">
                  {item.manufacturer}
                </p>
                <p className="text-[var(--color-text)]">{item.model}</p>
                {item.modelYear ? (
                  <p className="text-[var(--color-secondary)]">{item.modelYear}</p>
                ) : null}
                {item.notes ? (
                  <p className="mt-1 text-[var(--color-secondary)]">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {hasCompatibilityHtml ? (
          <div className={hasCompatibilityRows ? "mt-4" : undefined}>
            {compatibilityRich}
          </div>
        ) : null}

        {!hasCompatibilityRows && !hasCompatibilityHtml ? (
          <p className="text-sm text-[var(--color-secondary)]">
            Bu ürün için uyumluluk bilgisi bulunmuyor.
          </p>
        ) : null}
      </AccordionItem>
    </div>
  );
}
