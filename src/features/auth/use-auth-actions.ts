import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import type { LoginInput, RegisterInput, Session } from "@/api/contracts";
import { authApi, cartApi } from "@/api/endpoints";
import { queryKeys } from "@/api/query-keys";
import { applySession, clearSession, safeRedirect } from "./session";

/** Pós-autenticação comum a login e cadastro: sessão, carrinho do visitante e retorno ao fluxo. */
function useOnAuthenticated(redirectTo: string | undefined) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async (session: Session) => {
    applySession(queryClient, session);
    try {
      // Itens adicionados como visitante passam para a conta.
      const cart = await cartApi.mergeGuest();
      if (cart) {
        // A troca de sessão já disparou um GET /cart do usuário, que pode ter lido o carrinho antes
        // da mesclagem. Cancelado aqui, a resposta antiga não sobrescreve o resultado do merge.
        await queryClient.cancelQueries({ queryKey: queryKeys.cart(session.user.id) });
        queryClient.setQueryData(queryKeys.cart(session.user.id), cart);
      }
    } catch {
      toast.error("Não foi possível trazer os itens do carrinho de visitante.");
    }
    queryClient.removeQueries({ queryKey: queryKeys.cart("guest") });
    await router.navigate({ href: safeRedirect(redirectTo), replace: true });
  };
}

export function useLogin(redirectTo?: string) {
  const onAuthenticated = useOnAuthenticated(redirectTo);
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: onAuthenticated,
  });
}

export function useRegister(redirectTo?: string) {
  const onAuthenticated = useOnAuthenticated(redirectTo);
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: async (session) => {
      await onAuthenticated(session);
      toast.success("Conta criada. Boas-vindas à Kurio!");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    // Falha no servidor não impede o logout local: o token é descartado de qualquer forma.
    mutationFn: () => authApi.logout().catch(() => undefined),
    onSettled: async () => {
      clearSession(queryClient);
      toast.success("Você saiu da sua conta.");
      await router.navigate({ to: "/" });
    },
  });
}
