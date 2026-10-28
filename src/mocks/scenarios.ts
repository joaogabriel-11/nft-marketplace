/**
 * Cenários determinísticos da simulação. Selecione com ?scenario=<nome> na URL,
 * PUT /api/__dev/scenario { name } ou pelo localStorage "kurio:mock-scenario".
 */

/** Identificadores de rota usados para mirar latência e falhas. */
export type RouteTag =
  | "auth.register" | "auth.login" | "auth.session" | "auth.logout"
  | "nfts.list" | "nfts.detail" | "nfts.related"
  | "favorites.list" | "favorites.add" | "favorites.remove"
  | "cart.get" | "cart.add" | "cart.update" | "cart.remove" | "cart.coupon" | "cart.merge"
  | "checkout.quote" | "orders.create" | "orders.get" | "orders.list"
  | "profile.get" | "profile.update" | "profile.avatar" | "profile.password"
  | "wallets.list" | "wallets.upsert" | "wallets.connect" | "wallets.disconnect"
  | "health";

export type FailureKind = 500 | 503 | 401 | 403 | "network";

export interface FailureRule {
  tags: RouteTag[] | "*";
  kind: FailureKind;
  /** Só as N primeiras requisições falham (permite testar a recuperação). */
  times?: number;
}

export interface ScenarioConfig {
  description: string;
  latency: { min: number; max: number };
  /** nfts.list alterna respostas lentas e rápidas: respostas chegam fora de ordem. */
  outOfOrder?: boolean;
  failures?: FailureRule[];
  emptyCatalog?: boolean;
  sessionTtlMs?: number;
  paymentOutcome?: "confirmed" | "rejected";
  paymentDelayMs?: number;
  /** A primeira tentativa de cada pedido é criada, mas a resposta só chega depois do timeout do cliente. */
  orderTimeout?: boolean;
  /** Logo após a primeira cotação, o preço do primeiro item sobe 10%. */
  priceChangeAfterQuote?: boolean;
  /** Logo após a primeira cotação, a edição do primeiro item esgota. */
  soldOutAfterQuote?: boolean;
  /** A primeira tentativa de conexão de carteira é recusada. */
  walletRejectsOnce?: boolean;
}

const BASE = { latency: { min: 80, max: 220 } } satisfies Partial<ScenarioConfig>;

export const SCENARIOS = {
  default: { ...BASE, description: "Sucesso com latência baixa e variável" },
  instant: { latency: { min: 0, max: 0 }, description: "Sem latência (usado nos testes)" },
  slow: { latency: { min: 2500, max: 2500 }, description: "Toda resposta leva 2,5 s (skeletons)" },
  "variable-latency": { latency: { min: 100, max: 2000 }, description: "Latência entre 0,1 e 2 s" },
  "out-of-order": { ...BASE, outOfOrder: true, description: "Listagens alternam 1,5 s e 0,15 s" },
  "empty-catalog": { ...BASE, emptyCatalog: true, description: "Catálogo sem resultados" },
  offline: { ...BASE, failures: [{ tags: "*", kind: "network" }], description: "Sem conexão em toda a API" },
  "server-error": {
    ...BASE,
    failures: [{ tags: ["nfts.list", "nfts.detail", "cart.get"], kind: 500 }],
    description: "Catálogo, detalhe e carrinho respondem 500",
  },
  flaky: {
    ...BASE,
    failures: [{ tags: ["nfts.list", "nfts.detail", "cart.get"], kind: 503, times: 1 }],
    description: "A primeira chamada de catálogo, detalhe e carrinho responde 503",
  },
  "session-expired": { ...BASE, sessionTtlMs: 15_000, description: "Sessões expiram 15 s após o login" },
  forbidden: {
    ...BASE,
    failures: [{ tags: ["profile.get", "wallets.list"], kind: 403 }],
    description: "Perfil e carteiras respondem 403",
  },
  "favorites-fail": {
    ...BASE,
    failures: [{ tags: ["favorites.add", "favorites.remove"], kind: 500 }],
    description: "Incluir ou remover favorito falha (rollback otimista)",
  },
  "price-change": { ...BASE, priceChangeAfterQuote: true, description: "Preço sobe depois da primeira cotação" },
  "sold-out": { ...BASE, soldOutAfterQuote: true, description: "Edição esgota depois da primeira cotação" },
  "order-timeout": { ...BASE, orderTimeout: true, description: "Pedido criado, resposta após o timeout do cliente" },
  "payment-rejected": { ...BASE, paymentOutcome: "rejected", description: "Pagamento recusado" },
  "wallet-rejected": { ...BASE, walletRejectsOnce: true, description: "Primeira conexão de carteira recusada" },
} satisfies Record<string, ScenarioConfig>;

export type ScenarioName = keyof typeof SCENARIOS;

const STORAGE_KEY = "kurio:mock-scenario";
export const DEFAULT_PAYMENT_DELAY_MS = 3_000;
export const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const isScenarioName = (value: unknown): value is ScenarioName =>
  typeof value === "string" && value in SCENARIOS;

function readStored(): ScenarioName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isScenarioName(stored)) return stored;
  } catch {
    // ignore
  }
  return "default";
}

let active: ScenarioName = readStored();
/** Contadores de uso (falhas "times", efeitos "once"). Zeram ao trocar de cenário ou recarregar. */
let counters = new Map<string, number>();

export const scenario = {
  get name() {
    return active;
  },
  get config(): ScenarioConfig {
    return SCENARIOS[active];
  },
  set(name: ScenarioName) {
    active = name;
    counters = new Map();
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // ignore
    }
  },
  /** Incrementa e devolve quantas vezes `key` já ocorreu antes desta chamada. */
  hit(key: string) {
    const previous = counters.get(key) ?? 0;
    counters.set(key, previous + 1);
    return previous;
  },
  /** true só na primeira vez que `key` acontece no cenário ativo. */
  once(key: string) {
    return this.hit(`once:${key}`) === 0;
  },
};
