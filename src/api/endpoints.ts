import { z } from "zod";
import { api } from "./client";
import { HEADERS } from "./config";
import {
  cartSchema,
  favoritesSchema,
  nftDetailSchema,
  nftListResponseSchema,
  nftSummarySchema,
  orderListSchema,
  orderSchema,
  quoteSchema,
  sessionSchema,
  userSchema,
  walletConnectionSchema,
  walletsSchema,
  type AddCartItemInput,
  type Cart,
  type ChangePasswordInput,
  type CreateOrderInput,
  type LoginInput,
  type NftListParams,
  type OrderStatus,
  type RegisterInput,
  type UpdateProfileInput,
  type UpsertWalletInput,
  type WalletSlot,
} from "./contracts";
import { parseResponse } from "./errors";
import { guestCartStore, tokenStore } from "./storage";

/**
 * Funções de transporte: uma por operação REST. Recebem o `signal` do Query para
 * cancelamento e validam toda resposta contra o contrato antes de entregar à UI.
 */
type Opts = { signal?: AbortSignal };

const get = async <S extends z.ZodType>(schema: S, url: string, opts: Opts & { params?: object } = {}) =>
  parseResponse(schema, (await api.get(url, opts)).data);

const send = async <S extends z.ZodType>(
  schema: S,
  method: "post" | "put" | "patch" | "delete",
  url: string,
  body?: unknown,
  opts: Opts & { headers?: Record<string, string> } = {},
) => parseResponse(schema, (await api.request({ method, url, data: body, ...opts })).data);

const empty = z.unknown();

export const authApi = {
  register: (input: RegisterInput) => send(sessionSchema, "post", "/auth/register", input),
  login: (input: LoginInput) => send(sessionSchema, "post", "/auth/login", input),
  session: (opts?: Opts) => get(sessionSchema, "/auth/session", opts),
  logout: () => send(empty, "post", "/auth/logout"),
};

export const nftsApi = {
  list: (params: NftListParams, opts?: Opts) => get(nftListResponseSchema, "/nfts", { ...opts, params }),
  detail: (id: string, opts?: Opts) => get(nftDetailSchema, `/nfts/${encodeURIComponent(id)}`, opts),
  related: (id: string, opts?: Opts) =>
    get(z.object({ items: z.array(nftSummarySchema) }), `/nfts/${encodeURIComponent(id)}/related`, opts),
};

export const favoritesApi = {
  list: (opts?: Opts) => get(favoritesSchema, "/favorites", opts),
  add: (nftId: string) => send(favoritesSchema, "put", `/favorites/${encodeURIComponent(nftId)}`),
  remove: (nftId: string) => send(favoritesSchema, "delete", `/favorites/${encodeURIComponent(nftId)}`),
};

/** Visitante: guarda o id do carrinho devolvido pela API para as próximas chamadas. */
const rememberGuestCart = (cart: Cart) => {
  if (!tokenStore.get()) guestCartStore.set(cart.id);
  return cart;
};

export const cartApi = {
  get: (opts?: Opts) => get(cartSchema, "/cart", opts).then(rememberGuestCart),
  add: (input: AddCartItemInput) => send(cartSchema, "post", "/cart/items", input).then(rememberGuestCart),
  update: (itemId: string, quantity: number) =>
    send(cartSchema, "patch", `/cart/items/${encodeURIComponent(itemId)}`, { quantity }),
  remove: (itemId: string) => send(cartSchema, "delete", `/cart/items/${encodeURIComponent(itemId)}`),
  applyCoupon: (code: string) => send(cartSchema, "put", "/cart/coupon", { code }),
  removeCoupon: () => send(cartSchema, "delete", "/cart/coupon"),
  /** Chamado logo após autenticar; o carrinho de visitante deixa de existir. */
  mergeGuest: async () => {
    const guestCartId = guestCartStore.get();
    if (!guestCartId) return null;
    const cart = await send(cartSchema, "post", "/cart/merge", { guestCartId });
    guestCartStore.set(null);
    return cart;
  },
};

export const checkoutApi = {
  quote: () => send(quoteSchema, "post", "/checkout/quote"),
  /** A chave identifica a tentativa: reenvios (clique repetido, timeout) usam a mesma chave. */
  createOrder: (input: CreateOrderInput, idempotencyKey: string) =>
    send(orderSchema, "post", "/orders", input, { headers: { [HEADERS.idempotencyKey]: idempotencyKey } }),
  order: (id: string, opts?: Opts) => get(orderSchema, `/orders/${encodeURIComponent(id)}`, opts),
  orders: (status?: OrderStatus, opts?: Opts) => get(orderListSchema, "/orders", { ...opts, params: { status } }),
};

export const profileApi = {
  get: (opts?: Opts) => get(userSchema, "/profile", opts),
  update: (input: UpdateProfileInput) => send(userSchema, "patch", "/profile", input),
  updateAvatar: (dataUrl: string) => send(userSchema, "put", "/profile/avatar", { dataUrl }),
  removeAvatar: () => send(userSchema, "delete", "/profile/avatar"),
  changePassword: (input: ChangePasswordInput) => send(empty, "post", "/profile/password", input),
};

export const walletsApi = {
  list: (opts?: Opts) => get(walletsSchema, "/wallets", opts),
  upsert: (slot: WalletSlot, input: UpsertWalletInput) => send(walletsSchema, "put", `/wallets/${slot}`, input),
  connect: (walletId: string) => send(walletConnectionSchema, "post", `/wallets/${encodeURIComponent(walletId)}/connect`),
  disconnect: (walletId: string) => send(empty, "delete", `/wallets/${encodeURIComponent(walletId)}/connect`),
};
