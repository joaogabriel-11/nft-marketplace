import { QueryClient } from "@tanstack/react-query";

// Política inicial; será refinada e documentada em ARCHITECTURE.md no Bloco 1.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Mutations nunca repetem sozinhas: pedidos dependem de idempotência explícita.
        retry: 0,
      },
    },
  });
}
