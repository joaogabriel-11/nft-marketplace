import { test as base, expect, type Page } from "@playwright/test";

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
}

export interface CallOptions {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  /** Aborta a requisição no cliente após N ms (simula timeout do cliente). */
  abortAfterMs?: number;
}

/**
 * Chama a API simulada de dentro da página: a requisição passa pelo service worker do MSW,
 * exatamente como as chamadas do Axios da aplicação.
 */
export async function call<T = any>(page: Page, method: string, path: string, options: CallOptions = {}) {
  return page.evaluate(
    async ({ method, path, options }) => {
      const controller = new AbortController();
      if (options.abortAfterMs) setTimeout(() => controller.abort(), options.abortAfterMs);
      try {
        const response = await fetch(`/api${path}`, {
          method,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...options.headers,
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const text = await response.text();
        return { status: response.status, body: text ? JSON.parse(text) : null };
      } catch (error) {
        return { status: 0, body: { aborted: (error as Error).name === "AbortError" } };
      }
    },
    { method, path, options },
  ) as Promise<ApiResult<T>>;
}

export const CREDENTIALS = {
  ana: { email: "ana@kurio.dev", password: "ana12345" },
  bruno: { email: "bruno@kurio.dev", password: "bruno12345" },
} as const;

export async function login(page: Page, who: keyof typeof CREDENTIALS) {
  const result = await call<{ token: string; user: { id: string } }>(page, "POST", "/auth/login", {
    body: CREDENTIALS[who],
  });
  expect(result.status).toBe(200);
  return result.body;
}

export async function setScenario(page: Page, name: string) {
  const result = await call(page, "PUT", "/__dev/scenario", { body: { name } });
  expect(result.status).toBe(200);
}

/** Cada teste: página carregada, MSW ativo, banco resetado e cenário sem latência. */
export const test = base.extend<{ api: Page }>({
  api: async ({ page }, use) => {
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("API: ok");
    const reset = await call(page, "POST", "/__dev/reset", { body: { scenario: "instant" } });
    expect(reset.status).toBe(200);
    await use(page);
  },
});

export { expect };
