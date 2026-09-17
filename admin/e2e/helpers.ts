import { expect, type APIRequestContext, type Page } from "@playwright/test";

export function e2eApiBase(): string {
  return (
    process.env.E2E_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:3000/api/v1"
  );
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for authenticated Admin E2E (seed the test API first)`,
    );
  }
  return value;
}

export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: /Giriş yap/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });
}

export async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const res = await request.post(`${e2eApiBase()}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`API login failed: ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<{ accessToken: string }>;
}
