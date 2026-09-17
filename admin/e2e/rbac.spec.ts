import { test, expect } from "@playwright/test";
import { e2eApiBase, loginApi, loginViaUi, requiredEnv } from "./helpers";

test.describe("Admin RBAC", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${e2eApiBase()}/health/live`);
    if (!health.ok()) {
      throw new Error(
        `Admin RBAC E2E requires a running API at ${e2eApiBase()} (got ${health.status()})`,
      );
    }
  });

  test("PRODUCT_MANAGER cannot perform financial mutations (API + UI)", async ({
    page,
    request,
  }) => {
    const email = requiredEnv("E2E_PRODUCT_MANAGER_EMAIL");
    const password = requiredEnv("E2E_PRODUCT_MANAGER_PASSWORD");
    const { accessToken } = await loginApi(request, email, password);

    const accounting = await request.get(
      `${e2eApiBase()}/admin/accounting/transactions`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(accounting.status()).toBe(403);

    const manual = await request.post(`${e2eApiBase()}/admin/accounting/manual`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        customerId: "00000000-0000-4000-8000-000000000001",
        direction: "CREDIT",
        amount: "10.00",
        description: "should be denied",
      },
    });
    expect(manual.status()).toBe(403);

    const approve = await request.post(
      `${e2eApiBase()}/admin/bank-transfers/00000000-0000-4000-8000-000000000001/approve`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {},
      },
    );
    expect([403, 404]).toContain(approve.status());

    await loginViaUi(page, email, password);
    await expect(page.getByRole("link", { name: "Ürünler", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cari Hesap" }),
    ).toHaveCount(0);
    await page.goto("/accounting");
    await expect(page.getByText("Bu sayfa için yetkiniz yok.")).toBeVisible();
  });

  test("ACCOUNTING can read and mutate financial endpoints", async ({
    request,
  }) => {
    const email = requiredEnv("E2E_ACCOUNTING_EMAIL");
    const password = requiredEnv("E2E_ACCOUNTING_PASSWORD");
    const { accessToken } = await loginApi(request, email, password);

    const list = await request.get(`${e2eApiBase()}/admin/bank-transfers`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(list.status()).toBe(200);

    const tx = await request.get(
      `${e2eApiBase()}/admin/accounting/transactions`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(tx.status()).toBe(200);
  });

  test("SUPER_ADMIN can open required admin modules", async ({
    page,
    request,
  }) => {
    const email = requiredEnv("E2E_ADMIN_EMAIL");
    const password = requiredEnv("E2E_ADMIN_PASSWORD");
    const { accessToken } = await loginApi(request, email, password);

    const products = await request.get(`${e2eApiBase()}/admin/products`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(products.status()).toBe(200);

    const orders = await request.get(`${e2eApiBase()}/admin/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(orders.status()).toBe(200);

    const accounting = await request.get(
      `${e2eApiBase()}/admin/accounting/transactions`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(accounting.status()).toBe(200);

    await loginViaUi(page, email, password);
    await expect(page.getByRole("link", { name: "Cari Hesap" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ürünler", exact: true })).toBeVisible();
  });
});
