"use client";

import { useState } from "react";
import { clientApiDownload } from "@/lib/api/client";

export function StatementExportButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      await clientApiDownload(
        "/account/statement?format=csv",
        "account-statement.csv",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ekstre indirilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={loading}
        className="text-sm text-navy underline disabled:opacity-60"
      >
        {loading ? "İndiriliyor…" : "Ekstre indir (CSV)"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
