import Decimal from "decimal.js";
import { delay, HttpResponse } from "msw";
import {
  createOrderInputSchema,
  type Order,
  type OrderList,
  type Quote,
  type QuoteOutdatedDetails,
} from "@/api/contracts";
import { API_TIMEOUT_MS, HEADERS } from "@/api/config";
import { maxPerOrder } from "../domain/catalog";
import { activeCoupon, resolveCartItems, toQuoteItem, computeTotals } from "../domain/pricing";
import type { DbChange } from "../db/store";
import type { DbState, OrderRecord, QuoteRecord, UserRecord } from "../db/schema";
import { db } from "../db/store";
import { hashPayload, randomHex, randomId } from "../lib/crypto";
import { fail, notFound, nowIso, onBeforeRequest, parseBody, privateRoute } from "../lib/http";
import { DEFAULT_PAYMENT_DELAY_MS, scenario } from "../scenarios";

const QUOTE_TTL_MS = 5 * 60 * 1000;

const EXPLORERS = {
  ethereum: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  solana: "https://solscan.io/tx/",
} as const;

const toQuote = ({ userId: _u, cartId: _c, couponCode, ...quote }: QuoteRecord): Quote => ({
  ...quote,
  coupon: activeCoupon(couponCode),
});

export const toOrder = ({ userId: _u, quoteId: _q, settlesAt: _s, outcome: _o, ...order }: OrderRecord): Order =>
  order;

/**
 * Cotação a partir do carrinho atual. Falha se o carrinho estiver vazio ou com itens
 * que não podem ser comprados como estão (esgotados ou acima do limite).
 */
function buildQuote(user: UserRecord): { quote: QuoteRecord | null; blocking: QuoteOutdatedDetails["changes"] } {
  const cart = db.state.carts.find((c) => c.userId === user.id);
  const items = cart ? resolveCartItems(cart) : [];
  if (!cart || items.length === 0) return { quote: null, blocking: [] };

  const blocking = items
    .filter((item) => item.status === "sold_out" || item.status === "quantity_exceeds")
    .map((item) => ({
      type: item.status === "sold_out" ? ("unavailable" as const) : ("quantity_reduced" as const),
      nftId: item.nftId,
      editionId: item.editionId,
      message:
        item.status === "sold_out"
          ? `${item.name} (${item.editionLabel}) esgotou`
          : `${item.name} (${item.editionLabel}): disponível no máximo ${item.maxPerOrder}`,
    }));
  if (blocking.length) return { quote: null, blocking };

  const coupon = activeCoupon(cart.couponCode);
  const createdAt = nowIso();
  return {
    blocking,
    quote: {
      id: randomId("quo"),
      userId: user.id,
      cartId: cart.id,
      cartVersion: cart.version,
      items: items.map(toQuoteItem),
      couponCode: coupon?.code ?? null,
      totals: computeTotals(items.map((i) => i.lineTotalEth), coupon),
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + QUOTE_TTL_MS).toISOString(),
    },
  };
}

/** Compara a cotação aceita pelo usuário com o estado atual. Lista vazia = ainda válida. */
function diffQuote(accepted: QuoteRecord, fresh: QuoteRecord) {
  const changes: QuoteOutdatedDetails["changes"] = [];
  const freshByEdition = new Map(fresh.items.map((i) => [i.editionId, i]));
  for (const item of accepted.items) {
    const now = freshByEdition.get(item.editionId);
    if (!now) {
      changes.push({ type: "unavailable", nftId: item.nftId, editionId: item.editionId, message: `${item.name} saiu do carrinho` });
    } else if (!new Decimal(now.unitPriceEth).eq(item.unitPriceEth)) {
      changes.push({
        type: "price_changed",
        nftId: item.nftId,
        editionId: item.editionId,
        message: `${item.name}: preço mudou de ${item.unitPriceEth} para ${now.unitPriceEth} ETH`,
      });
    } else if (now.quantity !== item.quantity) {
      changes.push({ type: "quantity_reduced", nftId: item.nftId, editionId: item.editionId, message: `${item.name}: quantidade alterada` });
    }
  }
  if (fresh.items.length !== accepted.items.length && changes.length === 0) {
    changes.push({ type: "totals_changed", message: "Os itens do carrinho mudaram" });
  }
  if (accepted.couponCode !== fresh.couponCode) {
    changes.push({ type: "coupon_invalid", message: "O cupom aplicado não é mais válido" });
  }
  if (changes.length === 0 && accepted.totals.totalEth !== fresh.totals.totalEth) {
    changes.push({ type: "totals_changed", message: "Taxas ou total foram atualizados" });
  }
  return changes;
}

/** Efeitos de cenário que acontecem "no mundo" depois da cotação (outro comprador, reprecificação). */
function applyPostQuoteScenario(quote: QuoteRecord) {
  const config = scenario.config;
  const target = quote.items[0];
  if (!target) return;
  if (config.priceChangeAfterQuote && scenario.once("price-change")) {
    mutateEdition(target.nftId, target.editionId, (edition) => {
      edition.priceEth = new Decimal(edition.priceEth).mul("1.1").toDecimalPlaces(4).toFixed();
    });
  }
  if (config.soldOutAfterQuote && scenario.once("sold-out")) {
    mutateEdition(target.nftId, target.editionId, (edition) => {
      edition.available = 0;
    });
  }
}

/** Altera uma edição, incrementa a versão do NFT e notifica (fonte de nft.updated). */
export function mutateEdition(
  nftId: string,
  editionId: string,
  mutate: (edition: DbState["nfts"][number]["editions"][number]) => void,
) {
  return db.write(
    (draft) => {
      const nft = draft.nfts.find((n) => n.id === nftId) ?? notFound("NFT");
      const edition = nft.editions.find((e) => e.id === editionId) ?? notFound("Edição");
      mutate(edition);
      nft.version++;
      return nft;
    },
    (nft): DbChange[] => [{ type: "nft", id: nft.id, version: nft.version }],
  );
}

/**
 * Liquidação preguiçosa: pedidos pendentes vencidos são concluídos na próxima leitura
 * (ou pelo intervalo do worker). Assim o estado sobrevive a refresh e reconexão.
 */
export function settleDueOrders() {
  const now = Date.now();
  const due = db.state.orders.filter((o) => o.status === "pending" && Date.parse(o.settlesAt) <= now);
  if (!due.length) return;

  const changes: DbChange[] = [];
  db.write((draft) => {
    for (const { id } of due) {
      const order = draft.orders.find((o) => o.id === id)!;
      order.status = order.outcome;
      order.updatedAt = nowIso();
      order.version++;
      if (order.outcome === "confirmed") {
        const txHash = order.network === "solana" ? randomHex(32) : `0x${randomHex(32)}`;
        order.txHash = txHash;
        order.explorerUrl = EXPLORERS[order.network] + txHash;
        // Remove do carrinho só o que foi comprado (quantidades podem ter mudado depois).
        const cart = draft.carts.find((c) => c.userId === order.userId);
        if (cart) {
          for (const item of order.items) {
            const line = cart.lines.find((l) => l.editionId === item.editionId);
            if (line) line.quantity -= item.quantity;
          }
          cart.lines = cart.lines.filter((l) => l.quantity > 0);
          cart.version++;
          cart.updatedAt = nowIso();
        }
      } else {
        order.failureReason = "Pagamento recusado pela carteira";
        // Devolve o estoque reservado na criação.
        for (const item of order.items) {
          const nft = draft.nfts.find((n) => n.id === item.nftId);
          const edition = nft?.editions.find((e) => e.id === item.editionId);
          if (nft && edition) {
            edition.available += item.quantity;
            nft.version++;
            changes.push({ type: "nft", id: nft.id, version: nft.version });
          }
        }
      }
      changes.push({ type: "order", id: order.id, userId: order.userId, version: order.version });
    }
  }, changes);
}

onBeforeRequest(settleDueOrders);

function findOwnOrder(user: UserRecord, id: string) {
  const order = db.state.orders.find((o) => o.id === id) ?? notFound("Pedido");
  // Pedido de outro usuário: 403 (o recurso existe, mas não é seu).
  if (order.userId !== user.id) fail(403, "forbidden", "Este pedido pertence a outra conta");
  return order;
}

export const orderHandlers = [
  privateRoute("post", "/checkout/quote", "checkout.quote", ({ user }) => {
    const { quote, blocking } = buildQuote(user);
    if (blocking.length) {
      fail(409, "insufficient_availability", "Alguns itens não estão disponíveis como no carrinho", {
        details: { quote: null, changes: blocking } satisfies QuoteOutdatedDetails,
      });
    }
    if (!quote) return fail(422, "cart_empty", "Seu carrinho está vazio");
    db.write((draft) => {
      draft.quotes = draft.quotes.filter((q) => q.userId !== user.id).concat(quote);
    });
    applyPostQuoteScenario(quote);
    return HttpResponse.json(toQuote(quote), { status: 201 });
  }),

  privateRoute("post", "/orders", "orders.create", async ({ request, user, token }) => {
    const key = request.headers.get(HEADERS.idempotencyKey);
    if (!key || key.length < 8) fail(422, "validation_error", "Cabeçalho Idempotency-Key obrigatório");
    const input = await parseBody(request, createOrderInputSchema);
    const payloadHash = await hashPayload(input);

    // 1. Idempotência: a mesma tentativa devolve o mesmo pedido; conteúdo diferente é conflito.
    const previous = db.state.idempotency.find((r) => r.userId === user.id && r.key === key);
    if (previous) {
      if (previous.payloadHash !== payloadHash) {
        fail(409, "idempotency_conflict", "Esta chave de idempotência já foi usada com outro conteúdo");
      }
      return HttpResponse.json(toOrder(findOwnOrder(user, previous.orderId)));
    }

    // 2. Carteira conectada nesta sessão e coerente com a rede escolhida.
    const wallet = db.state.wallets.find((w) => w.id === input.walletId && w.userId === user.id) ?? notFound("Carteira");
    const connection = db.state.walletConnections.find(
      (c) =>
        c.id === input.connectionId && c.walletId === wallet.id && c.userId === user.id && c.sessionToken === token,
    );
    if (!connection) fail(409, "wallet_not_connected", "Conecte a carteira antes de confirmar");
    if (wallet.network !== input.network) {
      fail(422, "validation_error", "A rede escolhida não corresponde à carteira", {
        fieldErrors: { network: "Selecione a rede da carteira" },
      });
    }

    // 3. Revalidação: a cotação aceita precisa bater com preços, estoque, cupom e taxas atuais.
    const accepted = db.state.quotes.find((q) => q.id === input.quoteId && q.userId === user.id) ?? notFound("Cotação");
    const { quote: fresh, blocking } = buildQuote(user);
    // A cotação nova devolvida no 409 precisa existir para o usuário confirmar com ela.
    const storeFresh = () =>
      fresh &&
      db.write((draft) => {
        draft.quotes = draft.quotes.filter((q) => q.userId !== user.id).concat(fresh);
      });
    if (Date.parse(accepted.expiresAt) <= Date.now()) {
      storeFresh();
      fail(409, "quote_expired", "A cotação expirou. Revise os valores atualizados.", {
        details: { quote: fresh ? toQuote(fresh) : null, changes: blocking } satisfies QuoteOutdatedDetails,
      });
    }
    const changes = fresh ? diffQuote(accepted, fresh) : blocking;
    if (!fresh || changes.length) {
      storeFresh();
      fail(409, "quote_outdated", "Os valores mudaram desde a revisão. Confirme novamente.", {
        details: { quote: fresh ? toQuote(fresh) : null, changes } satisfies QuoteOutdatedDetails,
      });
    }

    // 4. Reserva estoque e cria o pedido pendente (snapshot completo para o recibo).
    const config = scenario.config;
    const createdAt = nowIso();
    const order: OrderRecord = {
      id: randomId("ord"),
      userId: user.id,
      quoteId: accepted.id,
      status: "pending",
      items: accepted.items,
      coupon: activeCoupon(accepted.couponCode),
      totals: accepted.totals,
      network: input.network,
      wallet: { id: wallet.id, type: wallet.type, address: wallet.address, nickname: wallet.nickname },
      buyer: input.buyer,
      txHash: null,
      explorerUrl: null,
      failureReason: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
      settlesAt: new Date(Date.now() + (config.paymentDelayMs ?? DEFAULT_PAYMENT_DELAY_MS)).toISOString(),
      outcome: config.paymentOutcome ?? "confirmed",
    };
    const nftChanges: DbChange[] = [];
    db.write(
      (draft) => {
        for (const item of order.items) {
          const nft = draft.nfts.find((n) => n.id === item.nftId)!;
          const edition = nft.editions.find((e) => e.id === item.editionId)!;
          if (item.quantity > maxPerOrder(edition)) {
            fail(409, "quote_outdated", "Disponibilidade mudou", { details: { quote: null, changes: [] } });
          }
          edition.available -= item.quantity;
          nft.version++;
          nftChanges.push({ type: "nft", id: nft.id, version: nft.version });
        }
        draft.orders.push(order);
        draft.idempotency.push({ key: key!, userId: user.id, payloadHash, orderId: order.id });
        draft.quotes = draft.quotes.filter((q) => q.id !== accepted.id);
      },
      () => [...nftChanges, { type: "order", id: order.id, userId: user.id, version: order.version }],
    );

    // Cenário: o pedido existe, mas a resposta só chega depois que o cliente desistiu.
    if (config.orderTimeout && scenario.once(`order-timeout:${key}`)) {
      await delay(API_TIMEOUT_MS + 2_000);
    }
    return HttpResponse.json(toOrder(order), { status: 201 });
  }),

  privateRoute<{ id: string }>("get", "/orders/:id", "orders.get", ({ user, params }) =>
    HttpResponse.json(toOrder(findOwnOrder(user, params.id))),
  ),

  privateRoute("get", "/orders", "orders.list", ({ user, url }) => {
    const status = url.searchParams.get("status");
    const items = db.state.orders
      .filter((o) => o.userId === user.id && (!status || o.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toOrder);
    return HttpResponse.json<OrderList>({ items });
  }),
];
