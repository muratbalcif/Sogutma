"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { apiRequest } from "@/lib/api-client";
import { configurePosHttp } from "furkansogutma-pos/api/http";

/**
 * Fullscreen POS shell: no admin sidebar/header.
 * Shares Phase 3 POS UI (`furkansogutma-pos`) over admin JWT via apiRequest.
 */
export default function PosSellLayout({ children }: { children: ReactNode }) {
  const [httpReady, setHttpReady] = useState(false);

  useEffect(() => {
    configurePosHttp(apiRequest);
    setHttpReady(true);
  }, []);

  if (!httpReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        POS hazırlanıyor…
      </div>
    );
  }

  return (
    <RequireAuth>
      <div className="pos-shell flex min-h-screen min-w-[1366px] flex-col bg-[var(--pos-bg,#f8fafc)] text-[var(--pos-text,#0f172a)]">
        {children}
      </div>
    </RequireAuth>
  );
}
