import type { Page } from "@playwright/test";
import sharp from "sharp";
import { call, CREDENTIALS, expect, openApp, setScenario, test } from "../support/api";
import { EMERALD, loginThroughForm, loginUI, storedToken } from "../support/app";

/** PNG real gerado na hora (decodificável por createImageBitmap no navegador). */
const avatarPng = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: "#d28a4c" } }).png().toBuffer();

const accountButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Conta de ${name}` }).filter({ visible: true });

test.describe("perfil", () => {
  test("edição com conflito por campo, persistência e header atualizado", async ({ page }) => {
    await openApp(page);
    await loginUI(page, "ana", "/perfil");

    const displayName = page.getByLabel("Nome de exibição");
    const username = page.getByLabel("Nome de usuário");
    await expect(displayName).toHaveValue("Ana Ribeiro");

    await username.fill("bruno.costa");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(username).toHaveAccessibleDescription("Este nome de usuário já está em uso");

    await username.fill("ana.r");
    await displayName.fill("Ana R.");
    await page.getByLabel("Nome ENS").fill("ana-r");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();
    await expect(accountButton(page, "Ana R.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nome de usuário")).toHaveValue("ana.r");
    await expect(page.getByLabel("Nome ENS")).toHaveValue("ana-r");
  });

  test("avatar: envio, persistência, remoção e arquivos recusados", async ({ page }) => {
    await openApp(page);
    await loginUI(page, "ana", "/perfil");
    const file = page.getByLabel("Arquivo do avatar");

    await file.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
    await expect(page.getByRole("alert")).toHaveText("Envie uma imagem PNG, JPG ou WEBP.");

    await file.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(6 * 1024 * 1024) });
    await expect(page.getByRole("alert")).toHaveText("Use uma imagem de até 5 MB.");

    await file.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: await avatarPng() });
    await expect(page.getByText("Avatar atualizado.")).toBeVisible();
    const preview = page.getByRole("img", { name: "Avatar de Ana Ribeiro" });
    await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);

    await page.reload();
    await expect(page.getByRole("img", { name: "Avatar de Ana Ribeiro" })).toBeVisible();
    await page.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Avatar removido.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Avatar de Ana Ribeiro" })).toHaveCount(0);
  });

  test("troca de senha valida a senha atual e passa a valer no login", async ({ page }) => {
    await openApp(page);
    await loginUI(page, "bruno", "/perfil");

    await page.getByLabel("Senha atual").fill("errada123");
    await page.getByLabel(/^Nova senha/).fill("novaSenha123");
    await page.getByLabel("Confirmar nova senha").fill("outraSenha123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByLabel("Confirmar nova senha")).toHaveAccessibleDescription("As senhas não conferem");

    await page.getByLabel("Confirmar nova senha").fill("novaSenha123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByLabel("Senha atual")).toHaveAccessibleDescription("Senha atual incorreta");

    await page.getByLabel("Senha atual").fill(CREDENTIALS.bruno.password);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Senha alterada. Outras sessões abertas foram encerradas.")).toBeVisible();
    await expect(page.getByLabel("Senha atual")).toHaveValue("");

    const login = await call(page, "POST", "/auth/login", { body: { email: CREDENTIALS.bruno.email, password: "novaSenha123" } });
    expect(login.status).toBe(200);
    const old = await call(page, "POST", "/auth/login", { body: CREDENTIALS.bruno });
    expect(old.status).toBe(401);
  });
});

test.describe("carteiras", () => {
  test("cadastro de principal e secundária com validação, duplicidade e uso no pagamento", async ({ page }) => {
    await openApp(page);
    await loginUI(page, "bruno", "/perfil/carteiras");

    const primary = page.getByRole("region", { name: "Carteira principal" });
    await expect(primary.getByText("Você ainda não adicionou uma carteira principal.")).toBeVisible();
    await primary.getByRole("button", { name: /Adicionar/ }).click();

    await primary.getByLabel("Nome de exibição").fill("Bruno Costa");
    await primary.getByLabel("Rede").selectOption("ethereum");
    await primary.getByLabel("Nome do perfil").fill("bruno.colecionador");
    await primary.getByLabel("Tipo de carteira").selectOption("coinbase");
    await primary.getByLabel("Endereço da carteira").fill("0x123");
    await primary.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(primary.getByLabel("Endereço da carteira")).toHaveAccessibleDescription(/40 caracteres hexadecimais/);

    const address = `0x${"b".repeat(40)}`;
    await primary.getByLabel("Endereço da carteira").fill(address);
    await primary.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(page.getByText("Carteira principal salva.")).toBeVisible();

    // Secundária: "Igual à carteira principal" copia os dados, menos o endereço.
    const secondary = page.getByRole("region", { name: "Carteira secundária" });
    await secondary.getByRole("button", { name: /Adicionar/ }).click();
    await secondary.getByLabel("Igual à carteira principal").check();
    await expect(secondary.getByLabel("Nome do perfil")).toHaveValue("bruno.colecionador");
    await expect(secondary.getByLabel("Endereço da carteira")).toHaveValue("");

    await secondary.getByLabel("Endereço da carteira").fill(address.toUpperCase().replace("0X", "0x"));
    await secondary.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(secondary.getByLabel("Endereço da carteira")).toHaveAccessibleDescription("Este endereço já está na sua outra carteira");

    await secondary.getByLabel("Rede").selectOption("polygon");
    await secondary.getByLabel("Endereço da carteira").fill(`0x${"c".repeat(40)}`);
    await secondary.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(page.getByText("Carteira secundária salva.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Carteira secundária" }).getByLabel("Rede")).toHaveValue("polygon");

    // A carteira cadastrada aqui é a usada no pagamento.
    const token = await storedToken(page);
    await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
    await page.goto("/pagamento");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("dialog").getByText("Coinbase Wallet")).toBeVisible();
  });

  test("acesso sem login e falha 403 da API", async ({ page }) => {
    await openApp(page, "/perfil/carteiras");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras/);
    await loginThroughForm(page, "ana");
    await expect(page).toHaveURL("/perfil/carteiras");

    await setScenario(page, "forbidden");
    await page.goto("/perfil");
    await expect(page.getByRole("alert").filter({ hasText: "Não conseguimos carregar seu perfil" })).toBeVisible();
    await page.goto("/perfil/carteiras");
    await expect(page.getByRole("alert").filter({ hasText: "Não conseguimos carregar suas carteiras" })).toBeVisible();
    await setScenario(page, "instant");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("region", { name: "Carteira principal" })).toBeVisible();
  });

  test("menu da conta leva ao perfil e às carteiras", async ({ page }) => {
    await openApp(page);
    await loginUI(page, "ana", "/");
    await accountButton(page, "Ana Ribeiro").click();
    await page.getByRole("menuitem", { name: "Carteiras" }).click();
    await expect(page).toHaveURL("/perfil/carteiras");
    await expect(page.getByRole("region", { name: "Carteira principal" }).getByLabel("Tipo de carteira")).toHaveValue("metamask");
  });
});
