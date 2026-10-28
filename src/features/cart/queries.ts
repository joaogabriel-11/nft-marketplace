import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddCartItemInput } from "@/api/contracts";
import { cartApi } from "@/api/endpoints";
import { queryKeys } from "@/api/query-keys";
import { useScope, useSession } from "@/features/auth/session";

/** Carrinho do usuário ou do visitante; a chave muda com o dono, então nunca mistura dados. */
export function useCart() {
  const { isPending } = useSession();
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.cart(scope),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    // Espera a sessão resolver para não buscar o carrinho de visitante de quem está logado.
    enabled: !isPending,
    staleTime: 15_000,
  });
}

export function useCartCount() {
  const { data } = useCart();
  return data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  const scope = useScope();
  return useMutation({
    mutationFn: (input: AddCartItemInput) => cartApi.add(input),
    // A resposta já é o carrinho completo e recalculado pela API.
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(scope), cart),
  });
}
