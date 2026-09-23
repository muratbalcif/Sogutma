import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors posAdminService.listSales query construction. */
function buildAdminPosSalesPath(
  page = 1,
  limit = 50,
  params?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    registerId?: string;
    userId?: string;
    customerId?: string;
    paymentMethod?: string;
    status?: string;
  },
): string {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (params?.search) query.set("search", params.search);
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  if (params?.registerId) query.set("registerId", params.registerId);
  if (params?.userId) query.set("userId", params.userId);
  if (params?.customerId) query.set("customerId", params.customerId);
  if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params?.status) query.set("status", params.status);
  return `/admin/pos/sales?${query.toString()}`;
}

function registerPaths(id?: string) {
  return {
    list: "/admin/pos/registers",
    create: "/admin/pos/registers",
    update: id ? `/admin/pos/registers/${id}` : null,
    cashiers: "/admin/pos/cashiers",
    saleDetail: id ? `/admin/pos/sales/${id}` : null,
  };
}

describe("admin POS sales list query", () => {
  it("omits empty optional filters", () => {
    assert.equal(
      buildAdminPosSalesPath(1, 20),
      "/admin/pos/sales?page=1&limit=20",
    );
  });

  it("includes sale number search and filters", () => {
    const path = buildAdminPosSalesPath(2, 20, {
      search: "POS-20260923-000123",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-23",
      registerId: "reg-1",
      userId: "user-1",
      customerId: "cust-1",
      paymentMethod: "CASH",
      status: "COMPLETED",
    });
    assert.ok(path.includes("search=POS-20260923-000123"));
    assert.ok(path.includes("registerId=reg-1"));
    assert.ok(path.includes("userId=user-1"));
    assert.ok(path.includes("customerId=cust-1"));
    assert.ok(path.includes("paymentMethod=CASH"));
    assert.ok(path.includes("page=2"));
  });

  it("supports retail customer filter", () => {
    const path = buildAdminPosSalesPath(1, 50, { customerId: "retail" });
    assert.ok(path.includes("customerId=retail"));
  });
});

describe("admin POS register paths", () => {
  it("exposes CRUD and related routes", () => {
    const paths = registerPaths("abc");
    assert.equal(paths.list, "/admin/pos/registers");
    assert.equal(paths.create, "/admin/pos/registers");
    assert.equal(paths.update, "/admin/pos/registers/abc");
    assert.equal(paths.cashiers, "/admin/pos/cashiers");
    assert.equal(paths.saleDetail, "/admin/pos/sales/abc");
  });
});

function buildAdminPosReportPath(
  kind: "summary" | "x" | "export.csv",
  params?: {
    from?: string;
    to?: string;
    registerId?: string;
    cashierId?: string;
  },
): string {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.registerId) query.set("registerId", params.registerId);
  if (params?.cashierId) query.set("cashierId", params.cashierId);
  const qs = query.toString();
  return `/admin/pos/reports/${kind}${qs ? `?${qs}` : ""}`;
}

describe("admin POS report paths", () => {
  it("builds summary and csv paths", () => {
    assert.equal(
      buildAdminPosReportPath("summary", {
        from: "2026-09-01",
        to: "2026-09-24",
      }),
      "/admin/pos/reports/summary?from=2026-09-01&to=2026-09-24",
    );
    assert.ok(
      buildAdminPosReportPath("export.csv", {
        from: "2026-09-01",
        to: "2026-09-02",
        registerId: "r1",
      }).includes("registerId=r1"),
    );
    assert.equal(buildAdminPosReportPath("x"), "/admin/pos/reports/x");
  });
});
