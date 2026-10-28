import type { Page } from "@playwright/test";
import { addToGuestCart, call, CREDENTIALS, expect, openApp, setScenario, test } from "../support/api";
import { EMERALD, GOLDEN, loginUI, readyForCheckout } from "../support/app";

const review = (page: Page) => page.getByRole("dialog");

test.describe("compra", () => {
  test("do catálogo ao recibo confirmado", async ({ page }) => {
    await openApp(page, "/nfts/emerald-ape-042");
    await page.getByRole("button", { name: /^(COMPRAR|Comprar NFT)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/carrinho");
    await page.getByRole("button", { name: "Conectar e finalizar" }).click();

    // Visitante passa pelo login e volta ao pagamento com o carrinho preservado.
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "E-mail" }).fill(CREDENTIALS.ana.email);
    await dialog.getByLabel("Senha", { exact: true }).fill(CREDENTIALS.ana.password);
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL("/pagamento");
    await expect(page.getByText("Emerald Ape #042").first()).toBeVisible();

    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(review(page).getByRole("heading", { name: "Revise sua compra" })).toBeVisible();
    await expect(review(page).getByText("1.206 ETH")).toBeVisible();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();

    await expect(page).toHaveURL(/\/pedidos\/ord_/);
    await expect(page.getByRole("heading", { name: "Processando pagamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Ver no Etherscan/ })).toHaveAttribute("href", /etherscan\.io\/tx\/0x/);

    // Após a confirmação, o carrinho perde só o que foi comprado.
    await page.goto("/carrinho");
    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });
});

test.describe("carrinho", () => {
  test("quantidade, remoção, cupom e persistência após refresh", async ({ page, isMobile }) => {
    await openApp(page);
    await addToGuestCart(page, [
      { ...EMERALD, quantity: 1 },
      { ...GOLDEN, quantity: 1 },
    ]);
    await page.goto("/carrinho");

    const emerald = page.getByRole("listitem").filter({ hasText: "Emerald Ape #042" });
    const plus = emerald.getByRole("button", { name: "Aumentar quantidade" });
    await plus.click();
    await plus.click();
    await expect(page.getByRole("complementary", { name: "Resumo da carteira" })).toContainText("Subtotal4.56 ETH");

    await page.getByRole("listitem").filter({ hasText: "Golden Beat #207" }).getByRole("button", { name: /Remover Golden Beat/ }).filter({ visible: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Golden Beat #207" })).toHaveCount(0);

    const coupon = page.getByRole("textbox", { name: "Código promocional" });
    await coupon.fill("nada");
    await coupon.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Código inválido" })).toBeVisible();
    await coupon.fill("expirado");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(coupon).toHaveAccessibleDescription("Código expirado");
    await coupon.fill("kurio10");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText(/Cupom KURIO10 · 10%/)).toBeVisible();
    // 3 × 1.19 = 3.57; −10% (0.357); + taxa 0.016 = 3.229 (calculado pela API, em decimal).
    await expect(page.getByRole("complementary", { name: "Resumo da carteira" })).toContainText("Total3.229 ETH");

    await page.reload();
    await expect(emerald.getByRole("status")).toHaveText("3");
    await expect(page.getByText(/Cupom KURIO10 · 10%/)).toBeVisible();
    if (!isMobile) await expect(page.getByRole("heading", { name: "Colecionadores também viram" })).toBeVisible();
  });

  test("preço alterado no catálogo pede confirmação no carrinho", async ({ page }) => {
    await openApp(page);
    await addToGuestCart(page, [{ ...EMERALD, quantity: 1 }]);
    await call(page, "PATCH", `/__dev/nfts/${EMERALD.nftId}/editions/${EMERALD.editionId}`, { body: { priceEth: "1.5" } });
    await page.goto("/carrinho");

    await expect(page.getByText("O preço mudou de 1.19 ETH para 1.5 ETH.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar e finalizar" })).toBeDisabled();
    await page.getByRole("button", { name: "Aceitar novo preço" }).click();
    await expect(page.getByRole("button", { name: "Conectar e finalizar" })).toBeEnabled();
  });
});

test.describe("pagamento", () => {
  test("preço alterado depois da cotação exige nova confirmação", async ({ page }) => {
    await readyForCheckout(page, { who: "ana", scenario: "price-change" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(review(page).getByRole("heading", { name: "Os valores mudaram" })).toBeVisible();
    await expect(review(page).getByRole("alert")).toContainText("preço mudou de 1.19 para 1.309 ETH");
    await review(page).getByRole("button", { name: "Confirmar novos valores" }).click();
    await expect(page).toHaveURL(/\/pedidos\/ord_/);
  });

  test("edição esgotada depois da cotação bloqueia a compra", async ({ page }) => {
    await readyForCheckout(page, { who: "ana", scenario: "sold-out" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(review(page).getByRole("alert")).toContainText("esgotou");
    await review(page).getByRole("button", { name: "Voltar ao carrinho" }).click();
    await expect(page.getByText("Esta edição esgotou.")).toBeVisible();
  });

  test("pagamento recusado mostra o motivo e preserva o carrinho", async ({ page }) => {
    await readyForCheckout(page, { who: "ana", scenario: "payment-rejected" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page.getByRole("heading", { name: "Pagamento recusado" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toHaveCount(0);
    await page.getByRole("link", { name: "Voltar ao carrinho" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Emerald Ape #042" })).toBeVisible();
  });

  test("clique repetido não cria pedido duplicado", async ({ page }) => {
    const auth = await readyForCheckout(page);
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    const confirm = review(page).getByRole("button", { name: "Confirmar pagamento" });
    await confirm.dblclick();
    await expect(page).toHaveURL(/\/pedidos\/ord_/);
    const orders = await call(page, "GET", "/orders", { token: auth });
    expect(orders.body.items).toHaveLength(1);
  });

  test("timeout após criar o pedido recupera o mesmo pedido pela chave de idempotência", async ({ page }) => {
    test.setTimeout(60_000);
    const auth = await readyForCheckout(page, { who: "ana", scenario: "order-timeout" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(review(page).getByRole("button", { name: "Processando pagamento…" })).toBeVisible();
    // 1ª tentativa: o servidor cria o pedido, mas o cliente desiste em 10 s e reenvia com a mesma chave.
    await expect(page).toHaveURL(/\/pedidos\/ord_/, { timeout: 25_000 });
    const orders = await call(page, "GET", "/orders", { token: auth });
    expect(orders.body.items).toHaveLength(1);
  });

  test("conexão recusada na carteira e nova tentativa", async ({ page }) => {
    await readyForCheckout(page, { who: "ana", scenario: "wallet-rejected" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "A conexão foi recusada na carteira" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(review(page).getByRole("heading", { name: "Revise sua compra" })).toBeVisible();
    await review(page).getByRole("button", { name: "Voltar e editar" }).click();
    await expect(page.getByText(/Conectada: MetaMask/)).toBeVisible();
  });

  test("pedido pendente é retomado após refresh", async ({ page }) => {
    const auth = await readyForCheckout(page);
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page.getByRole("heading", { name: "Processando pagamento" })).toBeVisible();
    await page.goto("/carrinho");
    await expect(page.getByText("Você tem um pedido em processamento.")).toBeVisible();
    await page.reload();
    await page.getByRole("link", { name: "Acompanhar pedido" }).click();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 10_000 });
    expect((await call(page, "GET", "/orders", { token: auth })).body.items).toHaveLength(1);
  });
});

test.describe("pagamento (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "Formulário completo visível por padrão só no desktop");

  test("usuário sem carteira cadastra no pagamento, com validação por campo", async ({ page }) => {
    await readyForCheckout(page, { who: "bruno" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByLabel("Endereço da carteira")).toHaveAccessibleDescription("Digite o endereço da carteira");
    await expect(page.getByLabel("Rede")).toHaveAccessibleDescription("Selecione uma rede");

    await page.getByLabel("Nome do perfil").fill("Bruno Costa");
    await page.getByLabel("Rede").selectOption("ethereum");
    await page.getByLabel("Tipo de carteira").selectOption("coinbase");
    await page.getByLabel("Endereço da carteira").fill("0x123");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByLabel("Endereço da carteira")).toHaveAccessibleDescription(/40 caracteres hexadecimais/);

    await page.getByLabel("Endereço da carteira").fill(`0x${"c".repeat(40)}`);
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(review(page).getByText("Coinbase Wallet")).toBeVisible();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page).toHaveURL(/\/pedidos\/ord_/);
  });

  test("sessão expirada no checkout leva ao login e retoma o rascunho", async ({ page }) => {
    const auth = await readyForCheckout(page);
    await page.getByLabel("Observação do colecionador (opcional)").fill("Presente para a coleção");
    await call(page, "POST", "/__dev/sessions/expire", { token: auth });
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page).toHaveURL(/\/login\?.*reason=expired/);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "E-mail" }).fill(CREDENTIALS.ana.email);
    await dialog.getByLabel("Senha", { exact: true }).fill(CREDENTIALS.ana.password);
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL("/pagamento");
    await expect(page.getByLabel("Observação do colecionador (opcional)")).toHaveValue("Presente para a coleção");
  });

  test("pedido de outra conta não é exibido", async ({ page }) => {
    await readyForCheckout(page);
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await review(page).getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page).toHaveURL(/\/pedidos\/ord_/);
    const url = page.url();
    await page.getByRole("button", { name: "Conta de Ana Ribeiro" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await loginUI(page, "bruno", "/");
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
    await setScenario(page, "instant");
  });
});
