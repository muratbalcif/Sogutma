import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirrors admin accountingService.reportCsvPath — path is relative to
 * NEXT_PUBLIC_API_BASE_URL (already includes /api/v1).
 */
function reportCsvPath(
  report: string,
  params?: { dateFrom?: string; dateTo?: string },
): string {
  const q = new URLSearchParams({ format: "csv" });
  if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params?.dateTo) q.set("dateTo", params.dateTo);
  return `/admin/finance/reports/${report}?${q}`;
}

describe("admin finance report CSV path", () => {
  it("builds authenticated download path under /api/v1 base", () => {
    const path = reportCsvPath("sales", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    assert.equal(
      path,
      "/admin/finance/reports/sales?format=csv&dateFrom=2026-01-01&dateTo=2026-01-31",
    );
    assert.ok(!path.includes("http"));
    assert.ok(!path.includes("/api/v1/api/v1"));
  });
});
