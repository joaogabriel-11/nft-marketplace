import type { NftListParams, OrderStatus } from "./contracts";

/**
 * Chaves do TanStack Query.
 * - Dados públicos ficam sob ["public", ...] e são compartilhados entre usuários.
 * - Dados privados ficam sob ["user", userId, ...]: trocar de usuário nunca reaproveita cache,
 *   e o logout remove tudo de ["user"] de uma vez.
 * - O carrinho de visitante usa userId "guest".
 */
export const queryKeys = {
  public: ["public"] as const,
  nfts: {
    all: ["public", "nfts"] as const,
    list: (params: NftListParams) => ["public", "nfts", "list", params] as const,
    detail: (id: string) => ["public", "nfts", "detail", id] as const,
    related: (id: string) => ["public", "nfts", "related", id] as const,
  },

  user: ["user"] as const,
  session: ["session"] as const,
  scoped: (userId: string) => ["user", userId] as const,
  favorites: (userId: string) => ["user", userId, "favorites"] as const,
  cart: (userId: string | "guest") => ["user", userId, "cart"] as const,
  quote: (userId: string) => ["user", userId, "quote"] as const,
  order: (userId: string, orderId: string) => ["user", userId, "orders", orderId] as const,
  orders: (userId: string, status?: OrderStatus) => ["user", userId, "orders", "list", status ?? "all"] as const,
  profile: (userId: string) => ["user", userId, "profile"] as const,
  wallets: (userId: string) => ["user", userId, "wallets"] as const,
};
