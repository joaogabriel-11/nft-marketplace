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

  test("Mercado desce até o catálogo, inclusive quando a URL já está em #catalogo", async ({ page }) => {
    await openApp(page);
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
    const mercado = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mercado" });
    const catalogTop = () => catalog(page).evaluate((element) => Math.round(element.getBoundingClientRect().top));

    await mercado.click();
    await expect(page).toHaveURL("/#catalogo");
    await expect.poll(catalogTop).toBeLessThanOrEqual(30);

    await page.evaluate(() => window.scrollTo(0, 0));
    await mercado.click();
    await expect.poll(catalogTop).toBeLessThanOrEqual(30);
  });

  test("faixa de preço filtra pela API, vai para a URL e sobrevive ao refresh", async ({ page }) => {
    await openApp(page);
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");

    // Teclado no slider: PageUp avança 10 passos de 0,01 ETH (0,02 → 1,92).
    const minThumb = page.getByRole("slider", { name: "Preço mínimo" });
    await minThumb.focus();
    for (let i = 0; i < 19; i++) await minThumb.press("PageUp");
    await expect(page.getByText(/^Preço: 1,92 - 12,30 ETH$/)).toBeVisible();
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/minPrice=1\.92&maxPrice=12\.3/);

    const expected = await call(page, "GET", "/nfts?minPrice=1.92&maxPrice=12.3&pageSize=9");
    await expect(catalogStatus(page)).toHaveText(`${expected.body.total} NFTs encontrados`);
    await expect(cardNames(page)).toHaveText(expected.body.items.map((item: { name: string }) => item.name));

    // Link direto: valores numéricos da URL chegam como texto (ETH é string decimal).
    await page.reload();
    await expect(catalogStatus(page)).toHaveText(`${expected.body.total} NFTs encontrados`);
    await expect(page.getByText(/^Preço: 1,92 - 12,30 ETH$/)).toBeVisible();

    await page.getByRole("group", { name: "Faixa de preço" }).getByRole("button", { name: "Limpar" }).click();
    await expect(page).not.toHaveURL(/minPrice/);
    await expect(catalogStatus(page)).toHaveText("45 NFTs encontrados");
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

test.describe("carrossel do hero", () => {
  const hero = (page: Page) => page.locator("[aria-roledescription=carrossel]").filter({ visible: true });
  const currentSlide = (page: Page) => hero(page).locator("[aria-roledescription=slide]:not([aria-hidden])");

  test("pontos trocam o slide, a troca automática anda e para com o foco, e o slide leva ao NFT", async ({ page }) => {
    await page.clock.install();
    await openApp(page);
    await expect(currentSlide(page)).toHaveAccessibleName("1 de 3: Emerald Ape #042");

    // Troca automática a cada 6 s (ponteiro fora do carrossel).
    await page.mouse.move(1, 1);
    await page.clock.runFor(6_100);
    await expect(currentSlide(page)).toHaveAccessibleName("2 de 3: Ivory Baron #088");

    // Com o foco nos pontos, a troca automática para.
    await hero(page).getByRole("button", { name: "Mostrar slide 3: Golden Beat #207" }).click();
    await expect(currentSlide(page)).toHaveAccessibleName("3 de 3: Golden Beat #207");
    await expect(hero(page).getByRole("button", { name: /Mostrar slide 3/ })).toHaveAttribute("aria-current", "true");
    await page.mouse.move(1, 1);
    await page.clock.runFor(13_000);
    await expect(currentSlide(page)).toHaveAccessibleName("3 de 3: Golden Beat #207");

    await currentSlide(page).getByRole("link").click();
    await expect(page).toHaveURL("/nfts/golden-beat-207");
  });

  test("clicar, segurar e arrastar em qualquer ponto do hero troca o slide; arraste curto volta", async ({ page }) => {
    await openApp(page);
    // Começa no título: o hero inteiro aceita o arraste, não só a arte.
    const box = (await hero(page).getByRole("heading", { level: 1 }).boundingBox())!;
    const drag = async (dx: number) => {
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 10 });
      await page.mouse.up();
    };

    await drag(-box.width / 2);
    await expect(currentSlide(page)).toHaveAccessibleName("2 de 3: Ivory Baron #088");
    await drag(box.width / 2);
    await expect(currentSlide(page)).toHaveAccessibleName("1 de 3: Emerald Ape #042");
    // Do primeiro para trás vai para o último.
    await drag(box.width / 2);
    await expect(currentSlide(page)).toHaveAccessibleName("3 de 3: Golden Beat #207");

    await drag(30);
    await expect(currentSlide(page)).toHaveAccessibleName("3 de 3: Golden Beat #207");
    await expect(page).toHaveURL("/");

    // Arrastar sobre o EXPLORAR troca o slide e não segue o link.
    const explore = (await hero(page).getByRole("link", { name: "EXPLORAR", exact: true }).boundingBox())!;
    await page.mouse.move(explore.x + explore.width / 2, explore.y + explore.height / 2);
    await page.mouse.down();
    await page.mouse.move(explore.x - 150, explore.y + explore.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(currentSlide(page)).toHaveAccessibleName("1 de 3: Emerald Ape #042");
    await expect(page).toHaveURL("/");
  });

  test.describe("com movimento reduzido", () => {
    test.use({ reducedMotion: "reduce" });

    test("não troca sozinho", async ({ page }) => {
      await page.clock.install();
      await openApp(page);
      await page.mouse.move(1, 1);
      await page.clock.runFor(13_000);
      await expect(currentSlide(page)).toHaveAccessibleName("1 de 3: Emerald Ape #042");
    });
  });
});
