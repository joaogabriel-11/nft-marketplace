import { COUPON_FIXTURES, FAVORITE_FIXTURES, USER_FIXTURES, WALLET_FIXTURES } from "../fixtures/users";
import { buildNftFixtures } from "../fixtures/nfts";
import type { DbState } from "./schema";

const STORAGE_KEY = "kurio:mock-db";
/** Incrementar quando o formato do DbState ou as fixtures mudarem: dados antigos são re-semeados. */
const SCHEMA_VERSION = 3;

/** Mudanças relevantes para tempo real. O transporte Socket.IO (Bloco 4) assina este canal. */
export type DbChange =
  | { type: "nft"; id: string; version: number }
  | { type: "order"; id: string; userId: string; version: number };

type ChangeListener = (change: DbChange) => void;

function seed(): DbState {
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    users: USER_FIXTURES,
    sessions: [],
    nfts: buildNftFixtures(),
    favorites: FAVORITE_FIXTURES,
    carts: [],
    coupons: COUPON_FIXTURES,
    quotes: [],
    wallets: WALLET_FIXTURES,
    walletConnections: [],
    orders: [],
    idempotency: [],
  });
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  } catch {
    // Storage indisponível ou corrompido: segue com o seed.
  }
  return seed();
}

let state: DbState = load();
const listeners = new Set<ChangeListener>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cota excedida (ex.: avatar grande) não derruba a simulação; perde só a persistência.
  }
}

export const db = {
  /** Leitura. Não mutar o retorno fora de `db.write`. */
  get state(): Readonly<DbState> {
    return state;
  },

  /**
   * Toda escrita passa por aqui. É transacional: a mutação roda sobre uma cópia e só
   * substitui o estado se terminar sem erro. Depois persiste e só então notifica,
   * para que REST e eventos sempre enxerguem o mesmo estado.
   */
  write<T>(mutate: (draft: DbState) => T, changes?: DbChange[] | ((result: T) => DbChange[])): T {
    const draft = structuredClone(state);
    const result = mutate(draft);
    state = draft;
    persist();
    const emitted = typeof changes === "function" ? changes(result) : (changes ?? []);
    for (const change of emitted) for (const listener of listeners) listener(change);
    return result;
  },

  subscribe(listener: ChangeListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Restaura integralmente o cenário conhecido. */
  reset() {
    state = seed();
    persist();
  },
};
