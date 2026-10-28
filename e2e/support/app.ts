import type { Page } from "@playwright/test";
import { call, CREDENTIALS, expect, openApp } from "./api";

/** Edições com estoque fixo nas fixtures (não dependem do PRNG): base dos testes de compra. */
export const EMERALD = { nftId: "emerald-ape-042", editionId: "emerald-ape-042--1-50" } as const;
export const GOLDEN = { nftId: "golden-beat-207", editionId: "golden-beat-207--aberta" } as const;
export const VIOLET = { nftId: "violet-nomad-314", editionId: "violet-nomad-314--1-50" } as const;
export const IVORY = { nftId: "ivory-baron-088", editionId: "ivory-baron-088--1-50" } as const;
export const editionPath = (item: { nftId: string; editionId: string }) =>
  `/__dev/nfts/${item.nftId}/editions/${item.editionId}`;

/** Conteúdo principal: desktop e mobile coexistem no DOM (um com display:none); filtre por visível. */
export const main = (page: Page) => page.locator("main");

/** Login pelo formulário real (dialog no desktop, tela cheia no mobile). */
export async function loginThroughForm(page: Page, who: keyof typeof CREDENTIALS) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "E-mail" }).fill(CREDENTIALS[who].email);
  await dialog.getByLabel("Senha", { exact: true }).fill(CREDENTIALS[who].password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Abre o login com destino e autentica pela interface; termina no destino. */
export async function loginUI(page: Page, who: keyof typeof CREDENTIALS, redirect: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await loginThroughForm(page, who);
  await expect(page).toHaveURL(redirect);
}

export const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem("kurio:token")!);

/** Usuário logado com itens no carrinho (via API, pelo service worker) e já na tela de pagamento. */
export async function readyForCheckout(
  page: Page,
  options: {
    who?: keyof typeof CREDENTIALS;
    scenario?: string;
    items?: Array<{ nftId: string; editionId: string; quantity: number }>;
  } = {},
) {
  const { who = "ana", scenario = "instant", items = [{ ...EMERALD, quantity: 2 }] } = options;
  await openApp(page, "/", scenario);
  await loginUI(page, who, "/carrinho");
  const token = await storedToken(page);
  for (const item of items) await call(page, "POST", "/cart/items", { token, body: item });
  await page.goto("/pagamento");
  await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  return token;
}

export async function realtimeClients(page: Page): Promise<Array<{ userId: string | null }>> {
  const { body } = await call(page, "GET", "/__dev/realtime");
  return Array.isArray(body?.clients) ? body.clients : [];
}

/** Espera o socket desta página conectar (e o servidor registrar a conexão do usuário). */
export async function waitRealtime(page: Page, userId: string | null = null) {
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "connected");
  await expect.poll(async () => (await realtimeClients(page)).some((c) => c.userId === userId)).toBe(true);
}
