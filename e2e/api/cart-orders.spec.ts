import type { Page } from "@playwright/test";
import { call, expect, login, setScenario, test } from "../support/api";

const EMERALD = { nftId: "emerald-ape-042", editionId: "emerald-ape-042--1-50" };
const BUYER = { displayName: "Ana Ribeiro", email: "ana@kurio.dev" };

/** Ana com 2× Emerald Ape 1/50 no carrinho e carteira principal conectada. */
async function readyToBuy(page: Page) {
  const { token } = await login(page, "ana");
  await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 2 } });
  const wallets = await call(page, "GET", "/wallets", { token });
  const walletId = wallets.body.primary.id as string;
  const connection = await call(page, "POST", `/wallets/${walletId}/connect`, { token });
  expect(connection.status).toBe(200);
  const quote = await call(page, "POST", "/checkout/quote", { token });
  expect(quote.status).toBe(201);
  const order = {
    quoteId: quote.body.id as string,
    walletId,
    connectionId: connection.body.connectionId as string,
    network: "ethereum",
    buyer: BUYER,
  };
  return { token, walletId, quote: quote.body, order };
}

const waitForStatus = (page: Page, token: string, orderId: string, status: string) =>
  expect
    .poll(async () => (await call(page, "GET", `/orders/${orderId}`, { token })).body.status, { timeout: 10_000 })
    .toBe(status);

test.describe("carrinho", () => {
  test("visitante adiciona itens e o carrinho é mesclado ao autenticar", async ({ api }) => {
    const guest = await call(api, "POST", "/cart/items", { body: { ...EMERALD, quantity: 1 } });
    expect(guest.status).toBe(201);
    const guestCartId = guest.body.id;
    const again = await call(api, "POST", "/cart/items", {
      headers: { "X-Guest-Cart-Id": guestCartId },
      body: { nftId: "golden-beat-207", editionId: "golden-beat-207--aberta", quantity: 3 },
    });
    expect(again.body.items).toHaveLength(2);

    const { token } = await login(api, "ana");
    const merged = await call(api, "POST", "/cart/merge", { token, body: { guestCartId } });
    expect(merged.body.items.map((i: { editionId: string }) => i.editionId)).toEqual([
      EMERALD.editionId,
      "golden-beat-207--aberta",
    ]);
    // O carrinho de visitante deixa de existir.
    const stale = await call(api, "GET", "/cart", { headers: { "X-Guest-Cart-Id": guestCartId } });
    expect(stale.body.id).not.toBe(guestCartId);
  });

  test("limite por edição, edição esgotada, alteração e remoção", async ({ api }) => {
    const { token } = await login(api, "ana");
    const over = await call(api, "POST", "/cart/items", {
      token,
      body: { nftId: "emerald-ape-042", editionId: "emerald-ape-042--1-10", quantity: 4 },
    });
    expect(over.status).toBe(409);
    expect(over.body.error).toMatchObject({ code: "insufficient_availability", details: { maxPerOrder: 3 } });

    const soldOut = await call(api, "POST", "/cart/items", {
      token,
      body: { nftId: "neon-vessel-552", editionId: "neon-vessel-552--1-1", quantity: 1 },
    });
    expect(soldOut.body.error.code).toBe("edition_unavailable");

    await call(api, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
    const updated = await call(api, "PATCH", `/cart/items/${EMERALD.editionId}`, { token, body: { quantity: 5 } });
    expect(updated.body.items[0]).toMatchObject({ quantity: 5, lineTotalEth: "5.95" });
    const removed = await call(api, "DELETE", `/cart/items/${EMERALD.editionId}`, { token });
    expect(removed.body.items).toEqual([]);
    expect(removed.body.totals.totalEth).toBe("0");
  });

  test("cupom válido, inválido e expirado com totais em precisão decimal", async ({ api }) => {
    const { token } = await login(api, "ana");
    await call(api, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 2 } });

    const invalid = await call(api, "PUT", "/cart/coupon", { token, body: { code: "NADA" } });
    expect(invalid.body.error.code).toBe("coupon_invalid");
    const expired = await call(api, "PUT", "/cart/coupon", { token, body: { code: "expirado" } });
    expect(expired.body.error.code).toBe("coupon_expired");

    const applied = await call(api, "PUT", "/cart/coupon", { token, body: { code: "kurio10" } });
    expect(applied.body.coupon.code).toBe("KURIO10");
    expect(applied.body.totals).toEqual({
      subtotalEth: "2.38",
      discountEth: "0.238",
      networkFeeEth: "0.016",
      totalEth: "2.158",
    });
    const removed = await call(api, "DELETE", "/cart/coupon", { token });
    expect(removed.body.totals.totalEth).toBe("2.396");
  });

  test("mudança de preço no catálogo aparece no carrinho", async ({ api }) => {
    const { token } = await login(api, "ana");
    await call(api, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
    await call(api, "PATCH", `/__dev/nfts/${EMERALD.nftId}/editions/${EMERALD.editionId}`, { body: { priceEth: "1.5" } });
    const cart = await call(api, "GET", "/cart", { token });
    expect(cart.body.items[0]).toMatchObject({ status: "price_changed", unitPriceEth: "1.5", addedUnitPriceEth: "1.19" });
  });
});

test.describe("pedidos", () => {
  test("compra confirmada: idempotência, snapshot do recibo e remoção só do que foi comprado", async ({ api }) => {
    const { token, order } = await readyToBuy(api);
    const key = "e2e-key-0001";

    const created = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": key } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "pending", totals: { totalEth: "2.396" } });

    // Clique repetido: mesma chave e mesmo conteúdo devolvem o mesmo pedido.
    const repeated = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": key } });
    expect(repeated.body.id).toBe(created.body.id);
    // Mesma chave com conteúdo diferente: conflito.
    const conflict = await call(api, "POST", "/orders", {
      token,
      body: { ...order, buyer: { ...BUYER, note: "outro" } },
      headers: { "Idempotency-Key": key },
    });
    expect(conflict.body.error.code).toBe("idempotency_conflict");

    // Itens adicionados depois do pedido continuam no carrinho após a confirmação.
    await call(api, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
    await waitForStatus(api, token, created.body.id, "confirmed");

    const receipt = await call(api, "GET", `/orders/${created.body.id}`, { token });
    expect(receipt.body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(receipt.body.explorerUrl).toContain("etherscan.io/tx/");
    const cart = await call(api, "GET", "/cart", { token });
    expect(cart.body.items).toEqual([expect.objectContaining({ editionId: EMERALD.editionId, quantity: 1 })]);

    // Alterar o catálogo depois não muda o recibo.
    await call(api, "PATCH", `/__dev/nfts/${EMERALD.nftId}/editions/${EMERALD.editionId}`, { body: { priceEth: "9" } });
    const after = await call(api, "GET", `/orders/${created.body.id}`, { token });
    expect(after.body.items[0].unitPriceEth).toBe("1.19");

    // Outro usuário não acessa o pedido.
    const bruno = await login(api, "bruno");
    expect((await call(api, "GET", `/orders/${created.body.id}`, { token: bruno.token })).status).toBe(403);
  });

  test("preço alterado após a cotação exige nova confirmação", async ({ api }) => {
    await setScenario(api, "price-change");
    const { token, order } = await readyToBuy(api);
    const outdated = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": "e2e-key-0002" } });
    expect(outdated.status).toBe(409);
    expect(outdated.body.error.code).toBe("quote_outdated");
    const { quote, changes } = outdated.body.error.details;
    expect(changes[0].type).toBe("price_changed");
    expect(quote.items[0].unitPriceEth).toBe("1.309");

    const confirmed = await call(api, "POST", "/orders", {
      token,
      body: { ...order, quoteId: quote.id },
      headers: { "Idempotency-Key": "e2e-key-0003" },
    });
    expect(confirmed.status).toBe(201);
  });

  test("edição esgotada após a cotação bloqueia a compra", async ({ api }) => {
    await setScenario(api, "sold-out");
    const { token, order } = await readyToBuy(api);
    const result = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": "e2e-key-0004" } });
    expect(result.body.error.code).toBe("quote_outdated");
    expect(result.body.error.details.changes[0].type).toBe("unavailable");
  });

  test("pagamento recusado devolve o estoque e preserva o carrinho", async ({ api }) => {
    await setScenario(api, "payment-rejected");
    const { token, order } = await readyToBuy(api);
    const created = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": "e2e-key-0005" } });
    const reserved = await call(api, "GET", `/nfts/${EMERALD.nftId}`);
    expect(reserved.body.editions[2].available).toBe(38);

    await waitForStatus(api, token, created.body.id, "rejected");
    const restored = await call(api, "GET", `/nfts/${EMERALD.nftId}`);
    expect(restored.body.editions[2].available).toBe(40);
    expect((await call(api, "GET", "/cart", { token })).body.items[0].quantity).toBe(2);
  });

  test("timeout após criar o pedido: reenvio com a mesma chave recupera o mesmo pedido", async ({ api }) => {
    await setScenario(api, "order-timeout");
    const { token, order } = await readyToBuy(api);
    const key = "e2e-key-0006";
    const timedOut = await call(api, "POST", "/orders", {
      token,
      body: order,
      headers: { "Idempotency-Key": key },
      abortAfterMs: 500,
    });
    expect(timedOut.status).toBe(0);

    const retry = await call(api, "POST", "/orders", { token, body: order, headers: { "Idempotency-Key": key } });
    expect(retry.status).toBe(200);
    const pending = await call(api, "GET", "/orders?status=pending", { token });
    expect(pending.body.items.map((o: { id: string }) => o.id)).toEqual([retry.body.id]);
  });

  test("carteira: recusa da conexão e pedido sem conexão ativa", async ({ api }) => {
    await setScenario(api, "wallet-rejected");
    const { token } = await login(api, "ana");
    const walletId = (await call(api, "GET", "/wallets", { token })).body.primary.id;
    const rejected = await call(api, "POST", `/wallets/${walletId}/connect`, { token });
    expect(rejected.body.error.code).toBe("wallet_rejected");
    const connected = await call(api, "POST", `/wallets/${walletId}/connect`, { token });
    expect(connected.body.status).toBe("connected");

    await call(api, "DELETE", `/wallets/${walletId}/connect`, { token });
    await call(api, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
    const quote = await call(api, "POST", "/checkout/quote", { token });
    const order = await call(api, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "e2e-key-0007" },
      body: { quoteId: quote.body.id, walletId, connectionId: connected.body.connectionId, network: "ethereum", buyer: BUYER },
    });
    expect(order.body.error.code).toBe("wallet_not_connected");
  });

  test("carteiras validam endereço por rede", async ({ api }) => {
    const { token } = await login(api, "bruno");
    const invalid = await call(api, "PUT", "/wallets/primary", {
      token,
      body: { displayName: "Bruno", network: "ethereum", type: "coinbase", address: "0x123" },
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.fieldErrors.address).toBeTruthy();

    const saved = await call(api, "PUT", "/wallets/primary", {
      token,
      body: { displayName: "Bruno", network: "ethereum", type: "coinbase", address: "0x" + "b".repeat(40) },
    });
    expect(saved.body.primary).toMatchObject({ type: "coinbase", nickname: null });
    const duplicate = await call(api, "PUT", "/wallets/secondary", {
      token,
      body: { displayName: "Bruno", network: "polygon", type: "metamask", address: "0x" + "B".repeat(40) },
    });
    expect(duplicate.status).toBe(409);
  });
});
