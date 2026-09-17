"use client";

import { ModulePage } from "@/components/auth/module-page";
import { useAuth } from "@/hooks/use-auth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <ModulePage>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Oturum
          </h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Ad</dt>
              <dd className="font-medium">
                {user?.firstName} {user?.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">E-posta</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">API</dt>
              <dd className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_API_BASE_URL}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Roller
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(user?.roles ?? []).map((role) => (
              <li
                key={role}
                className="rounded-md bg-slate-900 px-2 py-1 text-xs text-cyan-100"
              >
                {role}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            İzinler (RBAC)
          </h3>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {(user?.permissions ?? []).map((code) => (
              <li
                key={code}
                className="rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700"
              >
                {code}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ModulePage>
  );
}
