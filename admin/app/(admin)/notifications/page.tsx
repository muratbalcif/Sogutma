"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModulePage } from "@/components/auth/module-page";
import {
  emailOutboxService,
  notificationsService,
  type EmailOutboxItem,
} from "@/services/admin-api.service";

type Tab = "in-app" | "email";

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("email");
  const [status, setStatus] = useState<string>("");
  const [event, setEvent] = useState("");
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["admin-notifications-summary"],
    queryFn: async () => {
      const [email, inApp] = await Promise.all([
        emailOutboxService.summary(),
        notificationsService.summary(),
      ]);
      return { email, inApp };
    },
  });

  const inAppQuery = useQuery({
    queryKey: ["admin-notifications", event],
    queryFn: () =>
      notificationsService.list(1, 50, {
        eventKey: event || undefined,
      }),
    enabled: tab === "in-app",
  });

  const emailQuery = useQuery({
    queryKey: ["admin-email-outbox", status, event],
    queryFn: () =>
      emailOutboxService.list({
        page: 1,
        limit: 50,
        status: status || undefined,
        event: event || undefined,
      }),
    enabled: tab === "email",
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => emailOutboxService.retry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-email-outbox"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-notifications-summary"],
      });
    },
  });

  const summaryCards = useMemo(() => {
    const email = summaryQuery.data?.email;
    const inApp = summaryQuery.data?.inApp;
    if (!email || !inApp) return [];
    return [
      { label: "Email pending", value: email.pending },
      { label: "Email sent today", value: email.sentToday },
      { label: "Email failed today", value: email.failedToday },
      { label: "Email retrying", value: email.retrying },
      { label: "In-app total", value: inApp.inAppTotal },
      { label: "Outbox pending", value: inApp.pendingOutbox },
    ];
  }, [summaryQuery.data]);

  return (
    <ModulePage permission="notification.read">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bildirimler</h1>
          <p className="mt-1 text-sm text-slate-500">
            In-app, email outbox ve teslimat durumu
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {card.label}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "email"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setTab("in-app")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "in-app"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            In-app
          </button>
          {tab === "email" ? (
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tüm durumlar</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          ) : null}
          <input
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            placeholder="eventKey / event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          />
        </div>

        {tab === "email" ? (
          <EmailTable
            items={emailQuery.data?.items ?? []}
            total={emailQuery.data?.meta.total ?? 0}
            loading={emailQuery.isLoading}
            onRetry={(id) => retryMutation.mutate(id)}
            retryingId={
              retryMutation.isPending ? retryMutation.variables : undefined
            }
          />
        ) : (
          <InAppTable
            items={inAppQuery.data?.items ?? []}
            total={inAppQuery.data?.meta.total ?? 0}
            loading={inAppQuery.isLoading}
          />
        )}
      </div>
    </ModulePage>
  );
}

function EmailTable({
  items,
  total,
  loading,
  onRetry,
  retryingId,
}: {
  items: EmailOutboxItem[];
  total: number;
  loading: boolean;
  onRetry: (id: string) => void;
  retryingId?: string;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  }
  if (!items.length) {
    return <p className="text-sm text-slate-500">Email outbox boş.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Recipient</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Attempts</th>
            <th className="px-3 py-2 font-medium">Provider ID</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium">Sent</th>
            <th className="px-3 py-2 font-medium">Error</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-2">
                <div className="font-medium">{row.event}</div>
                <div className="text-xs text-slate-400">{row.eventKey}</div>
              </td>
              <td className="px-3 py-2">{row.toEmail}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.attempts}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {row.providerMessageId ?? "—"}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {new Date(row.createdAt).toLocaleString("tr-TR")}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {row.sentAt
                  ? new Date(row.sentAt).toLocaleString("tr-TR")
                  : "—"}
              </td>
              <td className="max-w-[220px] px-3 py-2 text-xs text-red-600">
                {row.lastError ?? "—"}
              </td>
              <td className="px-3 py-2">
                {row.status === "FAILED" ? (
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                    disabled={retryingId === row.id}
                    onClick={() => onRetry(row.id)}
                  >
                    Retry
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Toplam: {total}
      </div>
    </div>
  );
}

function InAppTable({
  items,
  total,
  loading,
}: {
  items: Array<{
    id: string;
    type: string;
    title: string;
    createdAt: string;
    readAt?: string | null;
  }>;
  total: number;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  }
  if (!items.length) {
    return <p className="text-sm text-slate-500">Bildirim bulunamadı.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Tip</th>
            <th className="px-4 py-3 font-medium">Başlık</th>
            <th className="px-4 py-3 font-medium">Okundu</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-4 py-3">{row.type}</td>
              <td className="px-4 py-3">{row.title}</td>
              <td className="px-4 py-3">{row.readAt ? "Evet" : "Hayır"}</td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(row.createdAt).toLocaleString("tr-TR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Toplam: {total}
      </div>
    </div>
  );
}
