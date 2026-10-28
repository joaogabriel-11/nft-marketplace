import type {
  Category,
  Coupon,
  Network,
  Order,
  QuoteItem,
  Totals,
  WalletSlot,
  WalletType,
} from "@/api/contracts";

// Registros internos do "servidor" simulado. Diferem dos contratos de propósito:
// guardam hash de senha, dono do recurso e campos que nunca saem na API.

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  avatarUrl: string | null;
  ensName: string | null;
  walletNickname: string | null;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface EditionRecord {
  id: string;
  label: string;
  supply: number | null;
  available: number;
  priceEth: string;
}

export interface NftRecord {
  id: string;
  tokenId: string;
  name: string;
  collection: string;
  category: Category;
  network: Network;
  imageKey: string;
  description: string;
  attributes: string[];
  contractAddress: string;
  royaltyPercent: number;
  rating: number;
  reviewsCount: number;
  listedAt: string;
  isNew: boolean;
  trendingScore: number;
  editions: EditionRecord[];
  version: number;
}

export interface CartLineRecord {
  nftId: string;
  editionId: string;
  quantity: number;
  addedUnitPriceEth: string;
}

export interface CartRecord {
  id: string;
  /** null para carrinho de visitante. */
  userId: string | null;
  lines: CartLineRecord[];
  couponCode: string | null;
  version: number;
  updatedAt: string;
}

export interface CouponRecord extends Coupon {
  expiresAt: string;
}

export interface QuoteRecord {
  id: string;
  userId: string;
  cartId: string;
  cartVersion: number;
  items: QuoteItem[];
  couponCode: string | null;
  totals: Totals;
  createdAt: string;
  expiresAt: string;
}

export interface WalletRecord {
  id: string;
  userId: string;
  slot: WalletSlot;
  displayName: string;
  nickname: string | null;
  network: Network;
  type: WalletType;
  address: string;
  ensName: string | null;
  referralCode: string | null;
  email: string | null;
  updatedAt: string;
}

export interface WalletConnectionRecord {
  id: string;
  userId: string;
  walletId: string;
  /** Conexão vale só para a sessão que a criou; logout a encerra. */
  sessionToken: string;
  connectedAt: string;
}

export interface OrderRecord extends Order {
  userId: string;
  quoteId: string;
  /** Quando a simulação de pagamento conclui; liquidação é preguiçosa (sobrevive a refresh). */
  settlesAt: string;
  /** Desfecho pré-determinado pelo cenário ativo no momento da criação. */
  outcome: "confirmed" | "rejected";
}

export interface IdempotencyRecord {
  key: string;
  userId: string;
  payloadHash: string;
  orderId: string;
}

export interface DbState {
  schemaVersion: number;
  users: UserRecord[];
  sessions: SessionRecord[];
  nfts: NftRecord[];
  favorites: Record<string, string[]>;
  carts: CartRecord[];
  coupons: CouponRecord[];
  quotes: QuoteRecord[];
  wallets: WalletRecord[];
  walletConnections: WalletConnectionRecord[];
  orders: OrderRecord[];
  idempotency: IdempotencyRecord[];
}
