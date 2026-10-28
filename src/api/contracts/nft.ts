import { z } from "zod";
import {
  ethAmountSchema,
  idSchema,
  isoDateSchema,
  networkSchema,
  paginationSchema,
} from "./common";

export const categorySchema = z.enum([
  "arte-digital",
  "fotografia",
  "musica",
  "arte-3d",
  "colecionaveis",
  "generativo",
  "jogos",
  "arquitetura",
  "utilidade",
]);
export type Category = z.infer<typeof categorySchema>;

export const editionSchema = z.object({
  id: idSchema,
  /** Rótulo do Figma: "1/1", "1/10", "1/50" ou "ABERTA". */
  label: z.string(),
  /** Tiragem total; null para edição aberta. */
  supply: z.number().int().positive().nullable(),
  available: z.number().int().nonnegative(),
  /** Limite por pedido, já considerando a disponibilidade. */
  maxPerOrder: z.number().int().nonnegative(),
  priceEth: ethAmountSchema,
});
export type Edition = z.infer<typeof editionSchema>;

export const nftSummarySchema = z.object({
  id: idSchema,
  tokenId: z.string(),
  name: z.string(),
  collection: z.string(),
  category: categorySchema,
  network: networkSchema,
  imageUrl: z.string(),
  /** Menor preço entre as edições disponíveis (ou da primeira, se todas esgotadas). */
  priceEth: ethAmountSchema,
  available: z.boolean(),
  isNew: z.boolean(),
  listedAt: isoDateSchema,
  /** Versão monotônica do recurso; usada para descartar eventos antigos do socket. */
  version: z.number().int().nonnegative(),
});
export type NftSummary = z.infer<typeof nftSummarySchema>;

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  images: z.array(z.object({ url: z.string(), alt: z.string() })).min(1),
  attributes: z.array(z.string()),
  contractAddress: z.string(),
  royaltyPercent: z.number().nonnegative(),
  rating: z.number().min(0).max(5),
  reviewsCount: z.number().int().nonnegative(),
  editions: z.array(editionSchema).min(1),
});
export type NftDetail = z.infer<typeof nftDetailSchema>;

export const nftTabSchema = z.enum(["all", "new", "trending"]);
export const nftSortSchema = z.enum(["recent", "price-asc", "price-desc", "name"]);
export type NftTab = z.infer<typeof nftTabSchema>;
export type NftSort = z.infer<typeof nftSortSchema>;

/** Parâmetros aceitos por GET /nfts. É o mesmo contrato validado na URL do catálogo. */
export const nftListParamsSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categories: z.array(categorySchema).optional(),
  networks: z.array(networkSchema).optional(),
  minPrice: ethAmountSchema.optional(),
  maxPrice: ethAmountSchema.optional(),
  tab: nftTabSchema.default("all"),
  sort: nftSortSchema.default("recent"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(48).default(9),
});
export type NftListParams = z.input<typeof nftListParamsSchema>;

export const nftListResponseSchema = paginationSchema.extend({
  items: z.array(nftSummarySchema),
  /** Contagens para os filtros, considerando busca e aba (não os próprios filtros). */
  facets: z.object({
    categories: z.record(categorySchema, z.number().int().nonnegative()),
    networks: z.record(networkSchema, z.number().int().nonnegative()),
    priceRange: z.object({ min: ethAmountSchema, max: ethAmountSchema }),
  }),
});
export type NftListResponse = z.infer<typeof nftListResponseSchema>;

export const favoritesSchema = z.object({ nftIds: z.array(idSchema) });
export type Favorites = z.infer<typeof favoritesSchema>;
