import type { Page } from "@playwright/test";
import { call, CREDENTIALS, expect, openApp, setScenario, test } from "../support/api";

/** Elementos do layout ativo (desktop e mobile coexistem no DOM, um deles com display:none). */
const visible = (page: Page) => page.locator("main");

/** Botão de favorito do NFT da página (mesmo nome acessível no desktop e no mobile). */
const favoriteButton = (page: Page, name: string) =>
  visible(page)
    .getByRole("button", { name: new RegExp(`^(Favoritar ${name}|Remover ${name} dos favoritos)$`) })
    .filter({ visible: true })
    .first();

async function loginThroughForm(page: Page, who: keyof typeof CREDENTIALS) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "E-mail" }).fill(CREDENTIALS[who].email);
  await dialog.getByLabel("Senha", { exact: true }).fill(CREDENTIALS[who].password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe("detalhe do NFT", () => {
  test("acesso direto, edição esgotada e limite de quantidade", async ({ page }) => {
    await openApp(page, "/nfts/emerald-ape-042");
    await expect(visible(page).getByRole("heading", { name: "Emerald Ape #042", level: 1 })).toBeVisible();

    const edition = (label: string) => visible(page).getByRole("radio", { name: label }).filter({ visible: true });
    await expect(edition("1/50")).toBeChecked();

    await edition("1/10").check();
    const plus = visible(page).getByRole("button", { name: "Aumentar quantidade" }).filter({ visible: true });
    await plus.click();
    await plus.click();
    await expect(plus).toBeDisabled();
    await expect(visible(page).getByText("3 de 10 disponíveis · até 3 por pedido.").filter({ visible: true })).toBeVisible();

    await call(page, "PATCH", "/__dev/nfts/neon-vessel-552/editions/neon-vessel-552--1-1", { body: { available: 0 } });
    await page.goto("/nfts/neon-vessel-552");
    await expect(visible(page).getByRole("radio", { name: "1/1 (esgotada)" }).filter({ visible: true })).toBeDisabled();
  });

  test("NFT inexistente mostra a página própria de não encontrado", async ({ page }) => {
    await openApp(page, "/nfts/nao-existe-999");
    await expect(page.getByRole("heading", { name: "Este NFT não existe ou saiu do mercado" })).toBeVisible();
    await page.getByRole("link", { name: "Explorar catálogo" }).click();
    await expect(page).toHaveURL(/#catalogo/);
  });

  test("comprar adiciona a edição escolhida e leva ao carrinho", async ({ page }) => {
    await openApp(page, "/nfts/emerald-ape-042");
    await visible(page).getByRole("button", { name: "Aumentar quantidade" }).filter({ visible: true }).click();
    await visible(page).getByRole("button", { name: /^(COMPRAR|Comprar NFT)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/carrinho");
    await expect(page.getByText("Emerald Ape #042 · 1/50 · 2×")).toBeVisible();
    // Visitante: o carrinho sobrevive ao refresh (id do carrinho de visitante no navegador).
    await page.reload();
    await expect(page.getByText("Emerald Ape #042 · 1/50 · 2×")).toBeVisible();
  });

  test("favorito com falha da API volta ao estado anterior (rollback otimista)", async ({ page }) => {
    await openApp(page, "/login?redirect=/nfts/sage-nomad-009");
    await loginThroughForm(page, "ana");
    await expect(page).toHaveURL("/nfts/sage-nomad-009");
    await setScenario(page, "favorites-fail");

    const favorite = favoriteButton(page, "Sage Nomad #009");
    await favorite.click();
    await expect(page.getByText(/Não foi possível favoritar Sage Nomad #009/)).toBeVisible();
    await expect(favorite).toHaveAttribute("aria-pressed", "false");

    await setScenario(page, "instant");
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(favoriteButton(page, "Sage Nomad #009")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("conta e sessão", () => {
  test("login valida campos, mostra erro da API e volta ao fluxo anterior", async ({ page }) => {
    await openApp(page, "/nfts/emerald-ape-042");
    // Visitante tenta favoritar: vai ao login guardando o destino.
    await favoriteButton(page, "Emerald Ape #042").click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnfts%2Femerald-ape-042/);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("textbox", { name: "E-mail" })).toBeFocused();
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    const email = dialog.getByRole("textbox", { name: "E-mail" });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Digite um e-mail válido");

    await email.fill("ana@kurio.dev");
    await dialog.getByLabel("Senha", { exact: true }).fill("senha-errada1");
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("E-mail ou senha incorretos");

    await dialog.getByLabel("Senha", { exact: true }).fill("ana12345");
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL("/nfts/emerald-ape-042");
    // Ana já tem Emerald Ape nos favoritos (dado do usuário, vindo da API).
    await expect(favoriteButton(page, "Emerald Ape #042")).toHaveAttribute("aria-pressed", "true");
  });

  test("cadastro mostra conflito de e-mail no campo e cria a conta", async ({ page }) => {
    await openApp(page, "/cadastro");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Nome de usuário" }).fill("nova.conta");
    await dialog.getByRole("textbox", { name: "E-mail" }).fill("ana@kurio.dev");
    await dialog.getByLabel("Senha", { exact: true }).fill("segredo123");
    await dialog.getByLabel("Confirmar senha").fill("segredo124");
    await dialog.getByRole("button", { name: /Criar (conta|perfil)/ }).click();
    await expect(dialog.getByLabel("Confirmar senha")).toHaveAccessibleDescription("As senhas não conferem");

    await dialog.getByLabel("Confirmar senha").fill("segredo123");
    await dialog.getByRole("button", { name: /Criar (conta|perfil)/ }).click();
    await expect(dialog.getByRole("textbox", { name: "E-mail" })).toHaveAccessibleDescription("Este e-mail já está cadastrado");

    await dialog.getByRole("textbox", { name: "E-mail" }).fill("nova@kurio.dev");
    await dialog.getByRole("button", { name: /Criar (conta|perfil)/ }).click();
    await expect(page.getByText("Conta criada. Boas-vindas à Kurio!")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("sessão expirada leva ao login preservando a tela e retoma depois", async ({ page }) => {
    await openApp(page, "/login?redirect=/nfts/ivory-baron-088");
    await loginThroughForm(page, "bruno");
    await expect(page).toHaveURL("/nfts/ivory-baron-088");

    const token = await page.evaluate(() => localStorage.getItem("kurio:token"));
    await call(page, "POST", "/__dev/sessions/expire", { token: token! });
    await favoriteButton(page, "Ivory Baron #088").click();

    await expect(page).toHaveURL(/\/login\?.*reason=expired/);
    await expect(page.getByText("Sua sessão expirou. Entre novamente para continuar de onde parou.")).toBeVisible();
    await loginThroughForm(page, "bruno");
    await expect(page).toHaveURL("/nfts/ivory-baron-088");
  });

  test("logout e troca de usuário não deixam dados do anterior", async ({ page }) => {
    await openApp(page, "/login?redirect=/nfts/emerald-ape-042");
    await loginThroughForm(page, "ana");
    await expect(favoriteButton(page, "Emerald Ape #042")).toHaveAttribute("aria-pressed", "true");
    await page.goto("/");

    // Header no desktop, barra inferior no mobile: o mesmo nome acessível.
    await page.getByRole("button", { name: "Conta de Ana Ribeiro" }).filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page.getByText("Você saiu da sua conta.")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("kurio:token"))).toBeNull();

    await page.goto("/login?redirect=/nfts/emerald-ape-042");
    await loginThroughForm(page, "bruno");
    await expect(page).toHaveURL("/nfts/emerald-ape-042");
    await expect(favoriteButton(page, "Emerald Ape #042")).toHaveAttribute("aria-pressed", "false");
  });

  test("dialog de login: Esc fecha e volta ao destino", async ({ page, isMobile }) => {
    test.skip(isMobile, "No mobile o login é tela cheia");
    await openApp(page, "/login?redirect=/nfts/emerald-ape-042");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL("/nfts/emerald-ape-042");
  });
});
