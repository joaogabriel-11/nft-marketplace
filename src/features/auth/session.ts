import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { redirect, type ParsedLocation } from "@tanstack/react-router";
import type { Session } from "@/api/contracts";
import { authApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { tokenStore } from "@/api/storage";

/**
 * Sessão = resposta de GET /auth/session para o token salvo (null sem token ou se inválido).
 * staleTime infinito: só muda por login, logout ou 401; não é refeita a cada tela.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: queryKeys.session,
  queryFn: async ({ signal }): Promise<Session | null> => {
    if (!tokenStore.get()) return null;
    try {
      return await authApi.session({ signal });
    } catch (error) {
      if (isApiError(error) && error.isUnauthenticated) {
        tokenStore.set(null);
        return null;
      }
      throw error;
    }
  },
  staleTime: Infinity,
  retry: false,
});

export function useSession() {
  const query = useQuery(sessionQueryOptions);
  return { session: query.data ?? null, user: query.data?.user ?? null, isPending: query.isPending };
}

/** Chave do carrinho/escopo privado do usuário atual ("guest" para visitante). */
export function useScope() {
  const { user } = useSession();
  return user?.id ?? "guest";
}

type Cleanup = () => void;
const cleanups = new Set<Cleanup>();

/** Recursos presos à sessão (ex.: socket no Bloco 4) registram aqui o que encerrar no logout. */
export function onSessionEnd(cleanup: Cleanup) {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
}

export function applySession(queryClient: QueryClient, session: Session) {
  // Troca de usuário sem logout explícito: nada do anterior pode sobrar.
  const previous = queryClient.getQueryData<Session | null>(queryKeys.session);
  if (previous && previous.user.id !== session.user.id) endSessionResources(queryClient);
  tokenStore.set(session.token);
  queryClient.setQueryData(queryKeys.session, session);
}

function endSessionResources(queryClient: QueryClient) {
  for (const cleanup of cleanups) cleanup();
  // Remove (não só invalida) todo dado privado: ["user", ...] inclusive o carrinho de visitante.
  queryClient.removeQueries({ queryKey: queryKeys.user });
}

/** Logout, troca de usuário ou sessão expirada: token, cache privado e subscriptions. */
export function clearSession(queryClient: QueryClient) {
  endSessionResources(queryClient);
  tokenStore.set(null);
  queryClient.setQueryData(queryKeys.session, null);
}

/** Aceita só caminhos internos ("/x"), nunca URLs externas ("//evil.com", "https://..."). */
export function safeRedirect(target: unknown, fallback = "/") {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

/** beforeLoad de rotas privadas: sem sessão vai ao login guardando o destino. */
export async function requireSession(queryClient: QueryClient, location: ParsedLocation) {
  const session = await queryClient.ensureQueryData(sessionQueryOptions);
  if (!session) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  return session;
}
