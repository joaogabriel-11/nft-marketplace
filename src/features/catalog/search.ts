import { z } from "zod";
import {
  categorySchema,
  ethAmountSchema,
  networkSchema,
  nftSortSchema,
  nftTabSchema,
  type Category,
  type Network,
  type NftListParams,
} from "@/api/contracts";

export const CATALOG_PAGE_SIZE = 9;

/** Lista na URL como texto separado por vírgula; itens desconhecidos são descartados. */
const csv = <T extends string>(item: z.ZodType<T>) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((part) => item.safeParse(part))
            .flatMap((result) => (result.success ? [result.data] : []))
        : [],
    )
    .catch([]);

/**
 * Estado do catálogo na URL (validado). Valores inválidos caem no padrão em vez de quebrar a tela:
 * um link antigo ou editado à mão continua abrindo o catálogo.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categories: csv<Category>(categorySchema),
  networks: csv<Network>(networkSchema),
  minPrice: ethAmountSchema.optional().catch(undefined),
  maxPrice: ethAmountSchema.optional().catch(undefined),
  tab: nftTabSchema.default("all").catch("all"),
  sort: nftSortSchema.default("recent").catch("recent"),
  page: z.coerce.number().int().positive().default(1).catch(1),
});

export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

/** Forma serializada na URL (listas como "a,b"); padrões são omitidos pelo middleware da rota. */
export interface CatalogSearchInput {
  q?: string;
  categories?: string;
  networks?: string;
  minPrice?: string;
  maxPrice?: string;
  tab?: CatalogSearch["tab"];
  sort?: CatalogSearch["sort"];
  page?: number;
}

export const CATALOG_DEFAULTS = { tab: "all", sort: "recent", page: 1 } as const;

export function toSearchInput(search: CatalogSearch): CatalogSearchInput {
  return {
    q: search.q || undefined,
    categories: search.categories.length ? search.categories.join(",") : undefined,
    networks: search.networks.length ? search.networks.join(",") : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab,
    sort: search.sort,
    page: search.page,
  };
}

/** Os parâmetros da API são exatamente o estado da URL (chave do cache inclusa). */
export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q || undefined,
    categories: search.categories.length ? [...search.categories].sort() : undefined,
    networks: search.networks.length ? [...search.networks].sort() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab,
    sort: search.sort,
    page: search.page,
    pageSize: CATALOG_PAGE_SIZE,
  };
}
