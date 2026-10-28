import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddCartItemInput, Cart } from "@/api/contracts";
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

/**
 * Toda mutation do carrinho compartilha o escopo "cart": o Query executa em fila, na ordem
 * dos cliques. Como cada resposta é o carrinho completo, a última aplicada é sempre a mais
 * recente e cliques rápidos não geram estados intermediários fora de ordem.
 */
function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Cart>) {
  const queryClient = useQueryClient();
  const scope = useScope();
  return useMutation({
    mutationFn,
    scope: { id: "cart" },
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(scope), cart),
  });
}

export const useAddToCart = () => useCartMutation((input: AddCartItemInput) => cartApi.add(input));

export const useUpdateCartItem = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.update(itemId, quantity));

export const useRemoveCartItem = () => useCartMutation((itemId: string) => cartApi.remove(itemId));

export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code));

export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon());

/** Itens que impedem seguir para o pagamento até o usuário resolver. */
export function cartBlockers(cart: Cart | undefined) {
  return cart?.items.filter((item) => item.status !== "ok") ?? [];
}
