import { test, expect } from "@playwright/test";
import { e2eApiBase, loginViaUi, requiredEnv } from "./helpers";

test.describe("Admin authenticated flows", () => {
  let seededCustomerEmail = "";

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${e2eApiBase()}/health/live`);
    if (!health.ok()) {
      throw new Error(
        `Admin authenticated E2E requires a running API at ${e2eApiBase()} (got ${health.status()})`,
      );
    }
    const suffix = Date.now();
    seededCustomerEmail = `e2e.customer.${suffix}@example.com`;
    const register = await request.post(`${e2eApiBase()}/auth/register`, {
      data: {
        email: seededCustomerEmail,
        password: "Password123!",
        firstName: "E2E",
        lastName: "Customer",
        userType: "INDIVIDUAL",
      },
    });
    if (!register.ok()) {
      throw new Error(
        `Failed to seed customer for admin e2e: ${register.status()} ${await register.text()}`,
      );
    }
  });

  test("login → dashboard → customers → customer detail → products → orders → bank transfers → accounting", async ({
    page,
  }) => {
    const email = requiredEnv("E2E_ADMIN_EMAIL");
    const password = requiredEnv("E2E_ADMIN_PASSWORD");
    await loginViaUi(page, email, password);

    await expect(page.getByText(/Merhaba,/)).toBeVisible();
    await expect(page.getByText("SUPER_ADMIN")).toBeVisible();

    await page.getByRole("link", { name: "Müşteriler" }).click();
    await expect(page).toHaveURL(/customers/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Müşteriler" }),
    ).toBeVisible();

    await page.getByPlaceholder(/İsim, e-posta/).fill(seededCustomerEmail);
    const e2eCustomer = page.getByRole("link", { name: "E2E Customer" });
    await expect(e2eCustomer).toHaveCount(1, { timeout: 15_000 });
    await e2eCustomer.click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+/i);
    await expect(page.getByRole("main").locator("h1")).toContainText("E2E");

    await page.getByRole("link", { name: "Ürünler", exact: true }).click();
    await expect(page).toHaveURL(/products/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Ürünler" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Siparişler" }).click();
    await expect(page).toHaveURL(/orders/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Siparişler" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Ödeme Doğrulama" }).click();
    await expect(page).toHaveURL(/bank-transfers/);
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { name: "Ödeme Doğrulama" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Cari Hesap" }).click();
    await expect(page).toHaveURL(/accounting/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Cari Hesap" }),
    ).toBeVisible();
  });
});
