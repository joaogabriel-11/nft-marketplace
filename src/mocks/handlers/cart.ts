import { HttpResponse } from "msw";
import {
  addCartItemInputSchema,
  applyCouponInputSchema,
  mergeCartInputSchema,
  updateCartItemInputSchema,
  type Cart,
} from "@/api/contracts";
import { HEADERS } from "@/api/config";
import { findEdition, maxPerOrder } from "../domain/catalog";
import { findCoupon, toCart } from "../domain/pricing";
import type { CartRecord, DbState, UserRecord } from "../db/schema";
import { db } from "../db/store";
import { randomId } from "../lib/crypto";
import { authenticate, fail, nowIso, parseBody, privateRoute, route } from "../lib/http";

/**
 * Dono do carrinho: usuário autenticado ou visitante (X-Guest-Cart-Id).
 * Carrinho de visitante nunca é acessível com token e vice-versa.
 */
function cartOwner(request: Request): { user: UserRecord | null; guestCartId: string | null } {
  const auth = authenticate(request);
  return { user: auth?.user ?? null, guestCartId: auth ? null : request.headers.get(HEADERS.guestCartId) };
}

function findCart(state: Readonly<DbState>, owner: ReturnType<typeof cartOwner>) {
  return owner.user
    ? state.carts.find((c) => c.userId === owner.user!.id)
    : state.carts.find((c) => c.userId === null && c.id === owner.guestCartId);
}

function newCart(userId: string | null): CartRecord {
  return { id: randomId("cart"), userId, lines: [], couponCode: null, version: 0, updatedAt: nowIso() };
}

/** Busca ou cria o carrinho do dono e aplica a mutação; versão incrementa a cada alteração. */
function mutateCart(request: Request, mutate: (cart: CartRecord) => void): Cart {
  const owner = cartOwner(request);
  const cart = db.write((draft) => {
    let cart = findCart(draft, owner);
    if (!cart) {
      cart = newCart(owner.user?.id ?? null);
      draft.carts.push(cart);
    }
    mutate(cart);
    cart.version++;
    cart.updatedAt = nowIso();
    return cart;
  });
  return toCart(cart);
}

function assertQuantity(nftId: string, editionId: string, quantity: number) {
  const { edition } = findEdition(nftId, editionId);
  if (edition.available === 0) fail(409, "edition_unavailable", "Esta edição está esgotada");
  const max = maxPerOrder(edition);
  if (quantity > max) {
    fail(409, "insufficient_availability", `Disponível no máximo ${max} por pedido`, {
      fieldErrors: { quantity: `Máximo de ${max}` },
      details: { maxPerOrder: max, available: edition.available },
    });
  }
  return edition;
}

export const cartHandlers = [
  route("get", "/cart", "cart.get", ({ request }) => {
    const owner = cartOwner(request);
    let cart = findCart(db.state, owner);
    if (!cart) {
      cart = newCart(owner.user?.id ?? null);
      db.write((draft) => {
        draft.carts.push(cart!);
      });
    }
    return HttpResponse.json(toCart(cart));
  }),

  route("post", "/cart/items", "cart.add", async ({ request }) => {
    const input = await parseBody(request, addCartItemInputSchema);
    const current = findCart(db.state, cartOwner(request))?.lines.find((l) => l.editionId === input.editionId);
    const edition = assertQuantity(input.nftId, input.editionId, (current?.quantity ?? 0) + input.quantity);
    const cart = mutateCart(request, (draft) => {
      const line = draft.lines.find((l) => l.editionId === input.editionId);
      if (line) line.quantity += input.quantity;
      else draft.lines.push({ ...input, addedUnitPriceEth: edition.priceEth });
    });
    return HttpResponse.json(cart, { status: 201 });
  }),

  route<{ itemId: string }>("patch", "/cart/items/:itemId", "cart.update", async ({ request, params }) => {
    const input = await parseBody(request, updateCartItemInputSchema);
    const line = findCart(db.state, cartOwner(request))?.lines.find((l) => l.editionId === params.itemId);
    if (!line) fail(404, "not_found", "Item não está no carrinho");
    const edition = assertQuantity(line!.nftId, line!.editionId, input.quantity);
    return HttpResponse.json(
      mutateCart(request, (draft) => {
        const target = draft.lines.find((l) => l.editionId === params.itemId)!;
        target.quantity = input.quantity;
        // Ao editar, o usuário passa a ver (e aceitar) o preço atual.
        target.addedUnitPriceEth = edition.priceEth;
      }),
    );
  }),

  route<{ itemId: string }>("delete", "/cart/items/:itemId", "cart.remove", ({ request, params }) =>
    HttpResponse.json(
      mutateCart(request, (draft) => {
        draft.lines = draft.lines.filter((l) => l.editionId !== params.itemId);
      }),
    ),
  ),

  route("put", "/cart/coupon", "cart.coupon", async ({ request }) => {
    const { code } = await parseBody(request, applyCouponInputSchema);
    const { coupon, expired } = findCoupon(code);
    if (!coupon) fail(422, "coupon_invalid", "Código promocional inválido", { fieldErrors: { code: "Código inválido" } });
    if (expired) fail(422, "coupon_expired", "Este código promocional expirou", { fieldErrors: { code: "Código expirado" } });
    return HttpResponse.json(
      mutateCart(request, (draft) => {
        draft.couponCode = coupon!.code;
      }),
    );
  }),

  route("delete", "/cart/coupon", "cart.coupon", ({ request }) =>
    HttpResponse.json(
      mutateCart(request, (draft) => {
        draft.couponCode = null;
      }),
    ),
  ),

  /** Ao autenticar: soma os itens do visitante ao carrinho do usuário, respeitando limites. */
  privateRoute("post", "/cart/merge", "cart.merge", async ({ request, user }) => {
    const { guestCartId } = await parseBody(request, mergeCartInputSchema);
    const cart = db.write((draft) => {
      const guest = draft.carts.find((c) => c.userId === null && c.id === guestCartId);
      let target = draft.carts.find((c) => c.userId === user.id);
      if (!target) {
        target = newCart(user.id);
        draft.carts.push(target);
      }
      if (guest) {
        for (const line of guest.lines) {
          const nft = draft.nfts.find((n) => n.id === line.nftId);
          const edition = nft?.editions.find((e) => e.id === line.editionId);
          if (!edition) continue;
          const existing = target.lines.find((l) => l.editionId === line.editionId);
          const quantity = Math.min((existing?.quantity ?? 0) + line.quantity, Math.max(maxPerOrder(edition), 1));
          if (existing) existing.quantity = quantity;
          else target.lines.push({ ...line, quantity });
        }
        target.couponCode ??= guest.couponCode;
        draft.carts = draft.carts.filter((c) => c !== guest);
        target.version++;
        target.updatedAt = nowIso();
      }
      return target;
    });
    return HttpResponse.json(toCart(cart));
  }),
];
