import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { CreateOrderInput, Order, UpsertWalletInput, WalletSlot } from "@/api/contracts";
import { checkoutApi, walletsApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { useSession } from "@/features/auth/session";
import { realtimeStore } from "@/lib/realtime/store";
import { checkoutStorage } from "./storage";

/** Sem socket o polling é a forma de acompanhar o pedido; com socket conectado vira só uma reserva. */
const PENDING_POLL_MS = 1_500;
const PENDING_POLL_WITH_REALTIME_MS = 10_000;
const MAX_ORDER_RETRIES = 3;
export const CREATE_ORDER_KEY = ["create-order"] as const;

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
  const router = useRouter();
  const { user } = useSession();
  return useMutation({
    mutationKey: CREATE_ORDER_KEY,
    mutationFn: ({ input, idempotencyKey }: { input: CreateOrderInput; idempotencyKey: string }) =>
      checkoutApi.createOrder(input, idempotencyKey),
    retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < MAX_ORDER_RETRIES,
    retryDelay: 1_000,
    // Callbacks da própria mutation (não do mutate()): rodam mesmo se a tela de pagamento
    // desmontar antes da resposta — ex.: o pedido liquidou e o carrinho esvaziou via tempo real
    // enquanto a resposta HTTP ainda estava a caminho (cenário de timeout).
    onSuccess: (order) => {
      checkoutStorage.pending.set(user!.id, { orderId: order.id, createdAt: order.createdAt });
      checkoutStorage.clearAttempt(user!.id);
      checkoutStorage.draft.clear(user!.id);
      queryClient.setQueryData<Order>(queryKeys.order(user!.id, order.id), (current) =>
        current && current.version >= order.version ? current : order,
      );
      void router.navigate({ to: "/pedidos/$id", params: { id: order.id } });
    },
  });
}

const isTerminal = (order: Order | undefined) => order?.status === "confirmed" || order?.status === "rejected";

/**
 * Estado do pedido. O order.updated do Socket.IO atualiza este cache na hora; o polling só é
 * frequente quando o tempo real está desconectado. Ao reconectar, a reconciliação refaz a query.
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
    refetchInterval: (query) =>
      isTerminal(query.state.data)
        ? false
        : realtimeStore.get().status === "connected"
          ? PENDING_POLL_WITH_REALTIME_MS
          : PENDING_POLL_MS,
    retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 5,
  });
}
