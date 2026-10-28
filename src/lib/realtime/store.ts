import { useSyncExternalStore } from "react";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting";

interface RealtimeState {
  status: RealtimeStatus;
  /** NFTs alterados por evento desde a montagem: checkout e carrinho reagem a isso. */
  nftChanges: Array<{ nftId: string; version: number; at: number }>;
}

let state: RealtimeState = { status: "idle", nftChanges: [] };
const listeners = new Set<() => void>();

function set(next: Partial<RealtimeState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export const realtimeStore = {
  get: () => state,
  setStatus(status: RealtimeStatus) {
    if (state.status === status) return;
    // Estado visível no DOM (diagnóstico e testes E2E esperam pela conexão desta página).
    document.documentElement.dataset.realtime = status;
    set({ status });
  },
  pushNftChange: (nftId: string, version: number) =>
    set({ nftChanges: [...state.nftChanges.slice(-49), { nftId, version, at: Date.now() }] }),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useRealtime<T>(select: (state: RealtimeState) => T): T {
  return useSyncExternalStore(realtimeStore.subscribe, () => select(realtimeStore.get()));
}

/**
 * Deduplicação e ordenação de eventos:
 * - eventId já visto → entrega duplicada, ignora;
 * - version <= última aplicada para o recurso → evento antigo/fora de ordem, ignora.
 * Também registra versões vindas da REST (ver `observeVersion`) para que um evento atrasado
 * não sobrescreva um estado mais novo que chegou por refetch.
 */
const MAX_SEEN = 500;
const seen = new Set<string>();
const versions = new Map<string, number>();

export const eventGate = {
  accept(eventId: string, resourceKey: string, version: number) {
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!);
    if ((versions.get(resourceKey) ?? -1) >= version) return false;
    versions.set(resourceKey, version);
    return true;
  },
  observeVersion(resourceKey: string, version: number) {
    if ((versions.get(resourceKey) ?? -1) < version) versions.set(resourceKey, version);
  },
  reset() {
    seen.clear();
    versions.clear();
  },
};
