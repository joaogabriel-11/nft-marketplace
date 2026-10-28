import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/api/errors";

const MAX_QUERY_RETRIES = 2;

/** Só falhas transitórias (rede, timeout, 502/503/504) são repetidas; 4xx e erros de contrato não. */
export function shouldRetry(failureCount: number, error: unknown) {
  return isApiError(error) && error.isTransient && failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Mutations nunca repetem sozinhas: repetir só com idempotência explícita (pedidos).
        retry: 0,
      },
    },
  });
}
