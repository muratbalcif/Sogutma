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
  technicalHtml,
  compatibilityHtml,
  technicalRich,
  compatibilityRich,
}: ProductContentSectionsProps) {
  const hasTechnical =
    attributes.length > 0 || Boolean(technicalHtml?.trim());
  const hasCompatibility =
    compatibility.length > 0 || Boolean(compatibilityHtml?.trim());

  const [open, setOpen] = useState<string | null>(() => {
    if (hasTechnical) return "technical";
    if (hasCompatibility) return "compatibility";
    return null;
  });

  if (!hasTechnical && !hasCompatibility) return null;

  const toggle = (id: string) =>
    setOpen((current) => (current === id ? null : id));

  return (
    <div className="mt-8 space-y-3">
      {hasTechnical ? (
        <AccordionItem
          id="technical"
          title="Teknik Özellikler"
          open={open === "technical"}
          onToggle={() => toggle("technical")}
        >
          {attributes.length > 0 ? (
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
          {technicalRich ? (
            <div className={attributes.length > 0 ? "mt-4" : undefined}>
              {technicalRich}
            </div>
          ) : null}
        </AccordionItem>
      ) : null}

      {hasCompatibility ? (
        <AccordionItem
          id="compatibility"
          title="Uyumluluk"
          open={open === "compatibility"}
          onToggle={() => toggle("compatibility")}
        >
          {compatibility.length > 0 ? (
            <ul className="space-y-2">
              {compatibility.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-[var(--color-text)]">
                    {item.manufacturer} {item.model}
                    {item.modelYear ? (
                      <span className="font-normal text-[var(--color-secondary)]">
                        {" "}
                        ({item.modelYear})
                      </span>
                    ) : null}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-[var(--color-secondary)]">
                      {item.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {compatibilityRich ? (
            <div className={compatibility.length > 0 ? "mt-4" : undefined}>
              {compatibilityRich}
            </div>
          ) : null}
        </AccordionItem>
      ) : null}
    </div>
  );
}
