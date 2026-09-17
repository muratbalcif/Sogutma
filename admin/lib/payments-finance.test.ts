import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors paymentsService.list query construction. */
function paymentsListPath(
  page = 1,
  limit = 20,
  params?: {
    status?: string;
    method?: string;
    orderNumber?: string;
    from?: string;
    to?: string;
  },
): string {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (params?.status) query.set("status", params.status);
  if (params?.method) query.set("method", params.method);
  if (params?.orderNumber) query.set("orderNumber", params.orderNumber);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  return `/admin/payments?${query.toString()}`;
}

function bankAccountPaths(id?: string) {
  return {
    list: "/admin/bank-accounts",
    create: "/admin/bank-accounts",
    update: id ? `/admin/bank-accounts/${id}` : null,
  };
}

function customerInvitePath() {
  return "/admin/customers/invite";
}

describe("admin payments list query", () => {
  it("omits empty optional filters", () => {
    assert.equal(paymentsListPath(1, 50), "/admin/payments?page=1&limit=50");
  });

  it("includes status, method, orderNumber and date range", () => {
    const path = paymentsListPath(2, 20, {
      status: "PAID",
      method: "BANK_TRANSFER",
      orderNumber: "FS-100",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    assert.equal(
      path,
      "/admin/payments?page=2&limit=20&status=PAID&method=BANK_TRANSFER&orderNumber=FS-100&from=2026-01-01&to=2026-01-31",
    );
  });
});

describe("admin bank accounts paths", () => {
  it("uses shared admin bank-accounts resource", () => {
    const paths = bankAccountPaths("11111111-1111-4111-8111-111111111111");
    assert.equal(paths.list, "/admin/bank-accounts");
    assert.equal(paths.create, "/admin/bank-accounts");
    assert.equal(
      paths.update,
      "/admin/bank-accounts/11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("admin customer invite path", () => {
  it("posts to invite endpoint", () => {
    assert.equal(customerInvitePath(), "/admin/customers/invite");
  });
});
