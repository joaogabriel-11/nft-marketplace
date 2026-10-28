import { call, expect, openApp, test } from "../support/api";
import { loginUI, main, readyForCheckout, storedToken } from "../support/app";

/**
 * Cenários sensíveis a tempo com o relógio controlado (page.clock). O "servidor" MSW roda
 * na página, então o mesmo relógio vale para a app e para a simulação: expiração de cotação,
 * TTL de sessão e liquidação do pagamento acontecem só quando o teste avança o tempo.
 */
test("cotação expirada: a revisão avisa e a API revalida os valores", async ({ page }) => {
  await page.clock.install();
  await readyForCheckout(page);
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText(/Cotação válida por 4:5\d/)).toBeVisible();

  await page.clock.fastForward("05:01");
  await expect(review.getByText("Esta cotação expirou. Ao confirmar, os valores serão revalidados.")).toBeVisible();
  await review.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(review.getByRole("heading", { name: "Os valores mudaram" })).toBeVisible();
  await expect(review.getByRole("alert")).toContainText("A cotação expirou e foi recalculada.");
  await expect(review.getByText(/Cotação válida por 4:5\d/)).toBeVisible();

  await review.getByRole("button", { name: "Confirmar novos valores" }).click();
  await expect(page).toHaveURL(/\/pedidos\/ord_/);
});

test("sessão expira pelo tempo (TTL de 15 s) e o login retoma a mesma tela", async ({ page }) => {
  await page.clock.install();
  await openApp(page, "/", "session-expired");
  await loginUI(page, "bruno", "/nfts/sage-nomad-009");

  await page.clock.fastForward(16_000);
  await main(page).getByRole("button", { name: "Favoritar Sage Nomad #009" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login\?.*reason=expired/);
  await expect(page).toHaveURL(/redirect=%2Fnfts%2Fsage-nomad-009/);
});

test("pagamento só liquida quando o relógio avança", async ({ page }) => {
  await page.clock.install();
  const token = await readyForCheckout(page);
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Processando pagamento" })).toBeVisible();

  // Tempo parado: o pedido continua pendente mesmo esperando em tempo real.
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.waitForTimeout(1_500);
  await expect(page.getByRole("heading", { name: "Processando pagamento" })).toBeVisible();
  const pending = await call(page, "GET", "/orders?status=pending", { token });
  expect(pending.body.items).toHaveLength(1);

  // Avança além do atraso de liquidação (3 s): o worker conclui e o order.updated chega.
  await page.clock.runFor(4_000);
  await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
  expect((await call(page, "GET", "/orders", { token: await storedToken(page) })).body.items).toHaveLength(1);
});

test("reset da simulação restaura o estado conhecido mesmo com relógio adiantado", async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await page.clock.fastForward("01:00:00");
  await call(page, "POST", "/__dev/reset", { body: { scenario: "instant" } });
  await page.goto("/");
  await expect(page.locator("#catalogo [role=status]")).toHaveText("45 NFTs encontrados");
});
