import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { NftListParams } from "@/api/contracts";
import { nftsApi } from "@/api/endpoints";
import { queryKeys } from "@/api/query-keys";

/**
 * Uma entrada de cache por combinação de parâmetros. Ao trocar filtros, a requisição anterior
 * é abortada (signal) e, se ainda assim responder, grava na chave antiga: nunca sobrescreve
 * a lista atual. placeholderData mantém a página anterior visível durante a troca.
 */
export const nftListQueryOptions = (params: NftListParams) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(params),
    queryFn: ({ signal }) => nftsApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

export const nftDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => nftsApi.detail(id, { signal }),
  });

export const nftRelatedQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.related(id),
    queryFn: ({ signal }) => nftsApi.related(id, { signal }),
    staleTime: 60_000,
  });
