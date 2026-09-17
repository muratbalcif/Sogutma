import { test, expect } from "@playwright/test";

/**
 * Admin UI smoke + route guards.
 * Full authenticated RBAC (PRODUCT_MANAGER / ACCOUNTING / SUPER_ADMIN) is covered
 * by API e2e (`api/test/security.e2e-spec.ts`) — UI button hiding alone is not enough.
 */
test.describe("Admin panel", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Admin Girişi" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByLabel("Şifre")).toBeVisible();
  });

  test("login validation requires email/password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Giriş yap/i }).click();
    await expect(page.getByText(/e-posta|şifre/i).first()).toBeVisible();
  });

  test("dashboard redirects guests to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("customers redirects guests to login", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/login/);
  });

  test("products redirects guests to login", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/login/);
  });

  test("orders redirects guests to login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/login/);
  });

  test("bank-transfers redirects guests to login", async ({ page }) => {
    await page.goto("/bank-transfers");
    await expect(page).toHaveURL(/login/);
  });

  test("accounting redirects guests to login", async ({ page }) => {
    await page.goto("/accounting");
    await expect(page).toHaveURL(/login/);
  });

  test("invalid credentials stay on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-posta").fill("nobody@example.com");
    await page.getByLabel("Şifre").fill("Password123!");
    await page.getByRole("button", { name: /Giriş yap/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
