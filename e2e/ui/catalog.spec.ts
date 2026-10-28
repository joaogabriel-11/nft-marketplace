import type { Page } from "@playwright/test";
import { call, expect, openApp, setScenario, test } from "../support/api";

const catalog = (page: Page) => page.locator("#catalogo");
const cardNames = (page: Page) => catalog(page).locator("article h3");
const catalogStatus = (page: Page) => catalog(page).locator("[role=status]");

test.describe("catálogo (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "Barra lateral de filtros só existe a partir do tablet");

  test("filtros combinados, ordenação e paginação compõem a URL e sobrevivem ao refresh e ao histórico", async ({ page }) => {
    await openApp(page);
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");

    await page.getByRole("button", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/page=2/);

    // Filtro novo reinicia a paginação.
    await catalog(page).getByRole("checkbox", { name: /Música/ }).check();
    await expect(page).not.toHaveURL(/page=/);
    await catalog(page).getByRole("checkbox", { name: /Colecionáveis/ }).check();
    await catalog(page).getByRole("checkbox", { name: /Polygon/ }).check();
    await expect(page).toHaveURL(/categories=musica,colecionaveis/);
    await expect(page).toHaveURL(/networks=polygon/);

    await page.getByRole("combobox", { name: /Ordenar por/ }).click();
    await page.getByRole("option", { name: "Menor preço" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);

    // A grade reflete exatamente o que a API devolve para os mesmos parâmetros.
    const expected = await call(page, "GET", "/nfts?categories=colecionaveis,musica&networks=polygon&sort=price-asc&pageSize=9");
    await expect(cardNames(page)).toHaveText(expected.body.items.map((item: { name: string }) => item.name));

    await page.reload();
    await expect(catalog(page).getByRole("checkbox", { name: /Música/ })).toBeChecked();
    await expect(cardNames(page)).toHaveText(expected.body.items.map((item: { name: string }) => item.name));

    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await page.goBack();
    await expect(page).not.toHaveURL(/networks=/);
    await page.goForward();
    await expect(page).toHaveURL(/networks=polygon/);
  });

  test("abas e busca pelo header filtram a listagem", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Novos lançamentos" }).click();
    await expect(page).toHaveURL(/tab=new/);
    await expect(catalogStatus(page)).toHaveText("12 NFTs encontrados");

    await page.getByRole("button", { name: "Buscar NFTs" }).click();
    await page.getByRole("searchbox", { name: "Termo de busca" }).fill("golden");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/q=golden/);
    await expect(cardNames(page)).toHaveText(["Golden Beat #207", "Golden Signal #160"]);
  });

  test("resultado vazio oferece limpar filtros", async ({ page }) => {
    await openApp(page, "/?q=nada-por-aqui");
    await expect(page.getByText("Nenhum NFT encontrado")).toBeVisible();
    await catalog(page).getByRole("button", { name: "Limpar filtros" }).last().click();
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
  });

  test("respostas fora de ordem não sobrescrevem a seleção mais recente", async ({ page }) => {
    await openApp(page, "/", "instant");
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
    await setScenario(page, "out-of-order");
    // 1ª requisição (lenta, 1,5 s) e logo depois a 2ª (rápida): a lenta chega por último.
    await page.getByRole("button", { name: "Novos lançamentos" }).click();
    await page.getByRole("button", { name: "Em alta" }).click();
    const trending = await call(page, "GET", "/nfts?tab=trending&pageSize=9");
    await expect(catalogStatus(page)).toHaveText(`${trending.body.total} NFTs encontrados`);
    await page.waitForTimeout(1_800);
    await expect(page).toHaveURL(/tab=trending/);
    await expect(cardNames(page)).toHaveText(trending.body.items.map((item: { name: string }) => item.name));
  });
});

test.describe("catálogo (todos os viewports)", () => {
  test("skeletons durante carregamento lento", async ({ page }) => {
    await openApp(page, "/", "slow");
    await expect(catalog(page).locator("[aria-busy=true] .skeleton").first()).toBeVisible();
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados", { timeout: 10_000 });
    await expect(catalog(page).locator(".skeleton")).toHaveCount(0);
  });

  test("falha do servidor mostra erro e a nova tentativa recupera", async ({ page }) => {
    await openApp(page, "/", "server-error");
    await expect(page.getByText("Não conseguimos carregar o catálogo")).toBeVisible();
    await setScenario(page, "instant");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
  });

  test("falha transitória é repetida automaticamente", async ({ page }) => {
    await openApp(page, "/", "flaky");
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
  });
});

test.describe("catálogo (mobile)", () => {
  test.skip(({ isMobile }) => !isMobile, "Barra de busca e sheet de filtros do layout mobile");

  test("busca com debounce e filtros no sheet atualizam a URL", async ({ page }) => {
    await openApp(page);
    // A busca cobre nome do NFT e da coleção ("Neon Nomads"): a grade espelha a API.
    await page.getByRole("searchbox", { name: "Explorar coleções" }).fill("nomad");
    await expect(page).toHaveURL(/q=nomad/);
    const nomad = await call(page, "GET", "/nfts?q=nomad&pageSize=9");
    await expect(cardNames(page)).toHaveText(nomad.body.items.map((item: { name: string }) => item.name));

    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("checkbox", { name: /Solana/ }).check();
    await expect(page).toHaveURL(/networks=solana/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    const solana = await call(page, "GET", "/nfts?q=nomad&networks=solana&pageSize=9");
    await expect(cardNames(page)).toHaveText(solana.body.items.map((item: { name: string }) => item.name));
    await expect(page.getByRole("button", { name: "Filtros, 1 ativos" })).toBeFocused();
  });
});
