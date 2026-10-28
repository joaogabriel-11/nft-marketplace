import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { onUnauthorized } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { clearSession } from "./session";

/**
 * 401 numa requisição autenticada (sessão expirada, revogada ou reset do mock):
 * limpa a sessão e leva ao login preservando a tela atual para retomar depois.
 * Várias requisições falhando juntas disparam um único redirecionamento.
 */
export function installUnauthorizedHandler(queryClient: QueryClient, router: AnyRouter) {
  return onUnauthorized((error) => {
    if (!queryClient.getQueryData(queryKeys.session)) return;
    clearSession(queryClient);
    toast.warning(error.code === "session_expired" ? "Sua sessão expirou. Entre novamente." : "Sua sessão terminou. Entre novamente.", {
      id: "session-ended",
    });
    const { pathname, href } = router.state.location;
    if (pathname === "/login" || pathname === "/cadastro") return;
    void router.navigate({ to: "/login", search: { redirect: href, reason: "expired" } });
  });
}
