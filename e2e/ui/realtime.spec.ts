import type { Page } from "@playwright/test";
import { addToGuestCart, call, expect, openApp, test } from "../support/api";
import { EMERALD, editionPath as editionPathOf, loginUI, realtimeClients, waitRealtime as waitConnected } from "../support/app";

/**
 * Tempo real: os eventos são gerados no servidor simulado (endpoints /__dev) e chegam à UI
 * pelo socket.io-client sobre o WebSocket interceptado pelo MSW. Nenhum teste recarrega a
 * página para ver a mudança: as queries envolvidas não têm polling.
 */
const editionPath = editionPathOf(EMERALD);

/** Preço da edição no detalhe: abaixo do título (desktop) ou na barra de compra (mobile, "Total: X ETH"). */
const detailPrice = (page: Page) =>
  page.locator("main").getByText(/^(Total: )?\d+(\.\d+)? ETH$/).filter({ visible: true }).first();

test("nft.updated atualiza o detalhe e o card do catálogo sem recarregar", async ({ page }) => {
  await openApp(page, "/nfts/emerald-ape-042");
  await waitConnected(page);
  await expect(detailPrice(page)).toContainText("1.19 ETH");

  await call(page, "PATCH", editionPath, { body: { priceEth: "1.5" } });
  await expect(detailPrice(page)).toContainText("1.5 ETH");

  await call(page, "PATCH", editionPath, { body: { available: 0 } });
  await expect(page.locator("main").getByRole("radio", { name: "1/50 (esgotada)" }).filter({ visible: true })).toBeDisabled();

  await page.goto("/");
  await waitConnected(page);
  const card = page.locator("#catalogo article").filter({ hasText: "Sage Nomad #009" });
  await expect(card).toContainText("1.69 ETH");
  await call(page, "PATCH", "/__dev/nfts/sage-nomad-009/editions/sage-nomad-009--1-50", { body: { priceEth: "1.42" } });
  await expect(card).toContainText("1.42 ETH");
});

test("carrinho aberto mostra a mudança de preço e atualiza o resumo", async ({ page }) => {
  await openApp(page);
  await addToGuestCart(page, [{ ...EMERALD, quantity: 2 }]);
  await page.goto("/carrinho");
  await waitConnected(page);
  const summary = page.getByRole("complementary", { name: "Resumo da carteira" });
  await expect(summary).toContainText("Total2.396 ETH");

  await call(page, "PATCH", editionPath, { body: { priceEth: "1.25" } });
  await expect(page.getByText("O preço de Emerald Ape #042 (1/50) mudou para 1.25 ETH.")).toBeVisible();
  await expect(page.getByText("O preço mudou de 1.19 ETH para 1.25 ETH.")).toBeVisible();
  await expect(summary).toContainText("Total2.516 ETH");
  await expect(page.getByRole("button", { name: "Conectar e finalizar" })).toBeDisabled();
});

test("checkout: evento durante a revisão bloqueia a cotação desatualizada", async ({ page }) => {
  await openApp(page);
  await loginUI(page, "ana", "/carrinho");
  const token = await page.evaluate(() => localStorage.getItem("kurio:token")!);
  await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
  await page.goto("/pagamento");
  await waitConnected(page, "usr_ana");
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("button", { name: "Confirmar pagamento" })).toBeVisible();

  await call(page, "PATCH", editionPath, { body: { priceEth: "1.33" } });
  await expect(review.getByRole("alert").filter({ hasText: "mudou agora há pouco" })).toBeVisible();
  await expect(review.getByRole("button", { name: "Confirmar pagamento" })).toHaveCount(0);

  await review.getByRole("button", { name: "Atualizar cotação" }).click();
  await expect(review.getByRole("heading", { name: "Os valores mudaram" })).toBeVisible();
  await expect(review.getByRole("alert")).toContainText("preço mudou de 1.19 para 1.33 ETH");
  await review.getByRole("button", { name: "Confirmar novos valores" }).click();
  await expect(page).toHaveURL(/\/pedidos\/ord_/);
  await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 10_000 });
});

test("eventos duplicados ou antigos não regridem o estado", async ({ page }) => {
  await openApp(page, "/nfts/emerald-ape-042");
  await waitConnected(page);
  // Socket conectado não garante a tela montada (com chunks lentos, como na demo, o detalhe monta
  // depois). Se o evento chegasse antes, a edição padrão seria outra: a 1/50 já não teria o preço do card.
  await expect(detailPrice(page)).toContainText("1.19 ETH");
  await call(page, "PATCH", editionPath, { body: { priceEth: "1.5" } });
  await expect(detailPrice(page)).toContainText("1.5 ETH");
  await call(page, "PATCH", editionPath, { body: { priceEth: "1.8" } });
  await expect(detailPrice(page)).toContainText("1.8 ETH");

  // Reentrega do evento anterior (versão menor) e duplicata do último: nada muda.
  const stale = await call(page, "POST", "/__dev/realtime/stale");
  expect(stale.body.replayed.version).toBeLessThan((await call(page, "GET", "/nfts/emerald-ape-042")).body.version);
  await call(page, "POST", "/__dev/realtime/duplicate");
  await page.waitForTimeout(500);
  await expect(detailPrice(page)).toContainText("1.8 ETH");
});

test("eventos perdidos durante a queda são reconciliados pela REST ao reconectar", async ({ page }) => {
  await openApp(page, "/nfts/emerald-ape-042");
  await waitConnected(page);
  await expect(detailPrice(page)).toContainText("1.19 ETH");
  await call(page, "POST", "/__dev/realtime/pause", { body: { paused: true } });
  await call(page, "PATCH", editionPath, { body: { priceEth: "2.05" } });
  await page.waitForTimeout(400);
  await expect(detailPrice(page)).toContainText("1.19 ETH");

  await call(page, "POST", "/__dev/realtime/pause", { body: { paused: false } });
  await call(page, "POST", "/__dev/realtime/disconnect", { body: { blockMs: 800 } });
  await expect(page.getByText("Reconectando atualizações em tempo real…")).toBeVisible();
  await expect(detailPrice(page)).toContainText("2.05 ETH", { timeout: 8_000 });
});

test("queda com pedido pendente: retoma o estado sem criar outra compra", async ({ page }) => {
  await openApp(page);
  await loginUI(page, "ana", "/carrinho");
  const token = await page.evaluate(() => localStorage.getItem("kurio:token")!);
  await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
  await page.goto("/pagamento");
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Processando pagamento" })).toBeVisible();

  // O pedido conclui (3 s) enquanto o tempo real está fora do ar.
  await call(page, "POST", "/__dev/realtime/disconnect", { body: { blockMs: 4_000 } });
  await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 12_000 });
  await waitConnected(page, "usr_ana");
  expect((await call(page, "GET", "/orders", { token })).body.items).toHaveLength(1);
});

test("logout fecha a conexão do usuário; a próxima sessão não herda a anterior", async ({ page }) => {
  await openApp(page);
  await loginUI(page, "ana", "/");
  await waitConnected(page, "usr_ana");

  await page.getByRole("button", { name: "Conta de Ana Ribeiro" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect.poll(async () => (await realtimeClients(page)).map((c) => c.userId)).toEqual([null]);

  await loginUI(page, "bruno", "/");
  await expect.poll(async () => (await realtimeClients(page)).map((c) => c.userId)).toEqual(["usr_bruno"]);
});

test("token inválido no handshake é recusado pelo servidor de tempo real", async ({ page }) => {
  await openApp(page);
  // Handshake cru do protocolo: Engine.IO "0" (open) seguido de Socket.IO "44" (CONNECT_ERROR).
  const packets = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const received: string[] = [];
        const url = `${window.location.origin.replace(/^http/, "ws")}/socket.io/?EIO=4&transport=websocket&token=token-falso`;
        const socket = new WebSocket(url);
        socket.onmessage = (event) => received.push(String(event.data));
        setTimeout(() => resolve(received), 1_000);
      }),
  );
  expect(packets[0]).toMatch(/^0{/);
  expect(packets[1]).toBe('44{"message":"unauthorized","data":{"code":"unauthorized"}}');
  expect(packets.some((p) => p.startsWith("40"))).toBe(false);
});
