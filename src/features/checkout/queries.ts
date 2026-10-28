import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput, Order, UpsertWalletInput, WalletSlot } from "@/api/contracts";
import { checkoutApi, walletsApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { useSession } from "@/features/auth/session";
import { checkoutStorage } from "./storage";

const PENDING_POLL_MS = 1_500;
const MAX_ORDER_RETRIES = 3;

export function useWallets() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.wallets(user?.id ?? "anonymous"),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: !!user,
  });
}

export function useSaveWallet() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: UpsertWalletInput }) => walletsApi.upsert(slot, input),
    onSuccess: (wallets) => queryClient.setQueryData(queryKeys.wallets(user!.id), wallets),
  });
}

export function useConnectWallet() {
  return useMutation({ mutationFn: (walletId: string) => walletsApi.connect(walletId) });
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (walletId: string) => walletsApi.disconnect(walletId) });
}

export function useCreateQuote() {
  return useMutation({ mutationFn: () => checkoutApi.quote() });
}

/**
 * Criação do pedido. A chave de idempotência vem de fora (persistida por intenção), então
 * qualquer reenvio — automático após timeout/queda de rede ou manual — recupera o mesmo pedido.
 * Erros de negócio (4xx) não são repetidos.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateOrderInput; idempotencyKey: string }) =>
      checkoutApi.createOrder(input, idempotencyKey),
    retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < MAX_ORDER_RETRIES,
    retryDelay: 1_000,
    onSuccess: (order) => {
      checkoutStorage.pending.set(user!.id, { orderId: order.id, createdAt: order.createdAt });
      checkoutStorage.clearAttempt(user!.id);
      queryClient.setQueryData(queryKeys.order(user!.id, order.id), order);
    },
  });
}

const isTerminal = (order: Order | undefined) => order?.status === "confirmed" || order?.status === "rejected";

/**
 * Estado do pedido. Enquanto pendente, consulta a API em intervalos (o Socket.IO do Bloco 4
 * adianta a atualização; o polling continua como reserva após reconexão). Terminal = para.
 */
export function useOrder(orderId: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.order(user?.id ?? "anonymous", orderId),
    queryFn: async ({ signal }) => {
      const order = await checkoutApi.order(orderId, { signal });
      if (isTerminal(order) && user) {
        checkoutStorage.pending.clear(user.id);
        // A API removeu do carrinho só o que foi comprado (ou devolveu o estoque): recarrega.
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart(user.id) });
      }
      return order;
    },
    enabled: !!user,
    refetchInterval: (query) => (isTerminal(query.state.data) ? false : PENDING_POLL_MS),
    retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 5,
  });
}
