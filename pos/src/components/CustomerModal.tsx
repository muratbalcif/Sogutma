import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerDetail, searchCustomers } from "../api/customers";
import { friendlyErrorMessage } from "../api/http";
import { usePosStore } from "../store/pos-store";
import { formatTry } from "../utils/money";

export function CustomerModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const setCustomer = usePosStore((s) => s.setCustomer);
  const customer = usePosStore((s) => s.customer);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const listQuery = useQuery({
    queryKey: ["customers", debounced],
    queryFn: () => searchCustomers(debounced, 1, 20),
  });

  async function select(id: string, fallbackName: string, phone: string | null, balance: string) {
    try {
      const detail = await getCustomerDetail(id);
      setCustomer({
        id,
        name:
          detail.corporate?.companyName ||
          `${detail.firstName} ${detail.lastName}` ||
          fallbackName,
        phone: detail.phone ?? phone,
        balance: detail.account?.balance ?? balance,
        creditLimit:
          detail.corporate?.creditLimit ??
          detail.account?.creditLimit ??
          null,
        allowCredit:
          detail.corporate?.allowCredit ??
          detail.account?.allowCredit ??
          false,
      });
      onClose();
    } catch (err) {
      setCustomer({
        id,
        name: fallbackName,
        phone,
        balance,
        creditLimit: null,
        allowCredit: false,
      });
      console.warn(friendlyErrorMessage(err));
      onClose();
    }
  }

  return (
    <ModalShell title="Müşteri Seç (F4)" onClose={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad, telefon, e-posta…"
        className="w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--primary)]"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
          onClick={() => {
            setCustomer(null);
            onClose();
          }}
        >
          Misafir (müşteri yok)
        </button>
        {customer ? (
          <span className="self-center text-sm text-slate-500">
            Seçili: {customer.name}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 max-h-80 space-y-2 overflow-auto">
        {(listQuery.data?.items ?? []).map((c) => {
          const name =
            c.companyName || `${c.firstName} ${c.lastName}`.trim();
          return (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-xl border border-[var(--border)] px-4 py-3 text-left hover:border-[var(--primary)]"
                onClick={() =>
                  void select(c.id, name, c.phone, c.balance)
                }
              >
                <span className="font-semibold">{name}</span>
                <span className="text-xs text-slate-500">
                  {c.phone ?? "—"} · {c.email}
                </span>
                <span className="mt-1 text-sm">
                  Cari:{" "}
                  <strong className="tabular-nums">{formatTry(c.balance)}</strong>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {listQuery.isError ? (
        <p className="mt-2 text-sm text-[var(--error)]">
          {friendlyErrorMessage(listQuery.error)}
        </p>
      ) : null}
    </ModalShell>
  );
}

export function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-5 shadow-xl ${
          wide ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ESC
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
