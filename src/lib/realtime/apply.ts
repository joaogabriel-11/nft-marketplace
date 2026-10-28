import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Cart, NftDetail, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from "@/api/contracts";
import { queryKeys } from "@/api/query-keys";
import { checkoutStorage } from "@/features/checkout/storage";
import { formatEth } from "@/lib/format";
import { realtimeStore } from "./store";

const SUMMARY_KEYS: (keyof NftSummary)[] = [
  "priceEth",
  "compareAtPriceEth",
  "available",
  "version",
  "isRare",
  "isNew",
  "name",
  "imageUrl",
];

/** Mescla só se o evento for mais novo que o dado em cache (nunca regride). */
function mergeSummary<T extends NftSummary>(current: T, event: NftUpdatedEvent): T {
  if (current.version >= event.version) return current;
  const next = { ...current };
  for (const key of SUMMARY_KEYS) (next as Record<string, unknown>)[key] = event.payload[key];
  return next;
}

/**
 * nft.updated: atualiza detalhe e cards em cache no lugar (sem refetch) e marca as listas
 * como desatualizadas (filtros de preço/disponibilidade podem mudar o resultado na próxima visita).
 * O carrinho é recarregado pela REST: totais, avisos e status são calculados pela API.
 */
export function applyNftUpdated(queryClient: QueryClient, scope: string, event: NftUpdatedEvent) {
  const id = event.resourceId;

  queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(id), (current) =>
    current && current.version < event.version
      ? { ...mergeSummary(current, event), editions: event.payload.editions }
      : current,
  );

  queryClient.setQueriesData<NftListResponse>({ queryKey: [...queryKeys.nfts.all, "list"] }, (current) =>
    current ? { ...current, items: current.items.map((item) => (item.id === id ? mergeSummary(item, event) : item)) } : current,
  );
  queryClient.setQueriesData<{ items: NftSummary[] }>({ queryKey: [...queryKeys.nfts.all, "related"] }, (current) =>
    current ? { items: current.items.map((item) => (item.id === id ? mergeSummary(item, event) : item)) } : current,
  );
  void queryClient.invalidateQueries({ queryKey: [...queryKeys.nfts.all, "list"], refetchType: "none" });

  const cart = queryClient.getQueryData<Cart>(queryKeys.cart(scope));
  const inCart = cart?.items.filter((item) => item.nftId === id) ?? [];
  if (inCart.length) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart(scope) });
    for (const item of inCart) {
      const edition = event.payload.editions.find((e) => e.id === item.editionId);
      if (!edition) continue;
      if (edition.available === 0) {
        toast.warning(`${item.name} (${item.editionLabel}) esgotou. Revise seu carrinho.`, { id: `rt:${item.id}` });
      } else if (edition.priceEth !== item.unitPriceEth) {
        toast.info(`O preço de ${item.name} (${item.editionLabel}) mudou para ${formatEth(edition.priceEth)}.`, { id: `rt:${item.id}` });
      } else if (item.quantity > edition.maxPerOrder) {
        toast.warning(`${item.name} (${item.editionLabel}): restam ${edition.maxPerOrder} por pedido.`, { id: `rt:${item.id}` });
      }
    }
  }
  realtimeStore.pushNftChange(id, event.version);
}

/**
 * order.updated: só para o dono (o servidor filtra e o cliente confere o userId).
 * Atualiza o pedido em cache e, se terminal, anuncia o resultado e recarrega o carrinho.
 */
export function applyOrderUpdated(queryClient: QueryClient, userId: string, event: OrderUpdatedEvent) {
  if (event.userId !== userId) return;
  const key = queryKeys.order(userId, event.resourceId);
  const current = queryClient.getQueryData<Order>(key);
  if (current && current.version >= event.version) return;
  queryClient.setQueryData(key, event.payload);

  const order = event.payload;
  if (order.status === "pending") return;
  checkoutStorage.pending.clear(userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId), exact: false });
  if (order.status === "confirmed") {
    toast.success("Pagamento confirmado. Seus NFTs estão na sua carteira.", { id: `order:${order.id}` });
  } else {
    toast.error(`Pagamento recusado. ${order.failureReason ?? ""}`.trim(), { id: `order:${order.id}` });
  }
}
