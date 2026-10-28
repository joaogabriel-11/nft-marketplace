import type { Page } from "@playwright/test";
import { call, CREDENTIALS, expect, openApp, test } from "../support/api";
import { EMERALD, IVORY, VIOLET } from "../support/app";

/**
 * Regressão visual de Início, Detalhe, Carrinho e Pagamento (desktop 1440 e mobile 390).
 * Dados estáveis: banco resetado, cenário "instant", relógio fixo e o mesmo carrinho.
 * Baselines por plataforma em e2e/visual/__screenshots__ (npm run test:visual:update).
 */
const FIXED_NOW = new Date("2026-10-28T12:00:00.000Z");

/** Espera o estado final da tela: fontes, imagens (inclusive lazy) e nenhum toast. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Rola a página inteira para disparar as imagens com loading="lazy".
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
  });
  // Só as imagens renderizadas: as de seções display:none (desktop no mobile) nunca carregam.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.images]
          .filter((img) => img.getClientRects().length > 0)
          .every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await page.mouse.move(0, 0);
}

async function loginWithToken(page: Page) {
  const session = await call<{ token: string }>(page, "POST", "/auth/login", { body: CREDENTIALS.ana });
  await page.evaluate((token) => localStorage.setItem("kurio:token", token), session.body.token);
  return session.body.token;
}

async function fillCart(page: Page, token: string) {
  for (const item of [
    { ...EMERALD, quantity: 2 },
    { ...VIOLET, quantity: 1 },
    { ...IVORY, quantity: 3 },
  ]) {
    await call(page, "POST", "/cart/items", { token, body: item });
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

test("início", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#catalogo [role=status]")).toHaveText("45 NFTs encontrados");
  await settle(page);
  await expect(page).toHaveScreenshot("inicio.png", { fullPage: true });
});

test("detalhe do NFT", async ({ page }) => {
  await openApp(page, "/nfts/emerald-ape-042");
  await expect(page.getByRole("heading", { name: "Mais desta coleção" })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("detalhe.png", { fullPage: true });
});

test("carrinho", async ({ page }) => {
  await openApp(page);
  const token = await loginWithToken(page);
  await fillCart(page, token);
  await page.goto("/carrinho");
  await expect(page.getByRole("listitem").filter({ hasText: "Ivory Baron #088" })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("carrinho.png", { fullPage: true });
});

test("pagamento", async ({ page }) => {
  await openApp(page);
  const token = await loginWithToken(page);
  await fillCart(page, token);
  await page.goto("/pagamento");
  await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  await settle(page);
  await expect(page).toHaveScreenshot("pagamento.png", { fullPage: true });
});
