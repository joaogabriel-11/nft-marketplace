import Decimal from "decimal.js";
import { HttpResponse } from "msw";
import {
  categorySchema,
  networkSchema,
  nftListParamsSchema,
  type Category,
  type Favorites,
  type Network,
  type NftListResponse,
  type NftSummary,
} from "@/api/contracts";
import { findNft, toDetail, toSummary } from "../domain/catalog";
import type { NftRecord } from "../db/schema";
import { db } from "../db/store";
import { fail, privateRoute, route } from "../lib/http";
import { scenario } from "../scenarios";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : undefined);
const int = (value: string | null) => (value === null ? undefined : Number(value));

function parseListParams(url: URL) {
  const sp = url.searchParams;
  const result = nftListParamsSchema.safeParse({
    q: sp.get("q") ?? undefined,
    categories: list(sp.get("categories")),
    networks: list(sp.get("networks")),
    minPrice: sp.get("minPrice") ?? undefined,
    maxPrice: sp.get("maxPrice") ?? undefined,
    tab: sp.get("tab") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    page: int(sp.get("page")),
    pageSize: int(sp.get("pageSize")),
  });
  if (!result.success) {
    return fail(422, "validation_error", "Parâmetros de busca inválidos", {
      fieldErrors: Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message])),
    });
  }
  return result.data;
}

const emptyCounts = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

const TRENDING_THRESHOLD = 500;

export const catalogHandlers = [
  route("get", "/nfts", "nfts.list", ({ url }) => {
    const params = parseListParams(url);
    const all = scenario.config.emptyCatalog ? [] : db.state.nfts;

    // Busca e aba definem a base; as contagens dos filtros são calculadas sobre ela.
    const query = params.q ? normalize(params.q) : "";
    const base = all.filter((nft) => {
      if (query && !normalize(`${nft.name} ${nft.collection}`).includes(query)) return false;
      if (params.tab === "new" && !nft.isNew) return false;
      if (params.tab === "trending" && nft.trendingScore < TRENDING_THRESHOLD) return false;
      return true;
    });

    const summaries = new Map<NftRecord, NftSummary>(base.map((nft) => [nft, toSummary(nft)]));
    const filtered = base.filter((nft) => {
      const price = summaries.get(nft)!.priceEth;
      if (params.categories?.length && !params.categories.includes(nft.category)) return false;
      if (params.networks?.length && !params.networks.includes(nft.network)) return false;
      if (params.minPrice && new Decimal(price).lt(params.minPrice)) return false;
      if (params.maxPrice && new Decimal(price).gt(params.maxPrice)) return false;
      return true;
    });

    const compare: Record<typeof params.sort, (a: NftRecord, b: NftRecord) => number> = {
      recent: (a, b) => b.listedAt.localeCompare(a.listedAt),
      "price-asc": (a, b) => new Decimal(summaries.get(a)!.priceEth).cmp(summaries.get(b)!.priceEth),
      "price-desc": (a, b) => new Decimal(summaries.get(b)!.priceEth).cmp(summaries.get(a)!.priceEth),
      name: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    };
    const sorted = [...filtered].sort((a, b) =>
      params.tab === "trending" && params.sort === "recent"
        ? b.trendingScore - a.trendingScore
        : compare[params.sort](a, b) || a.id.localeCompare(b.id),
    );

    const total = sorted.length;
    const start = (params.page - 1) * params.pageSize;
    const categories = emptyCounts<Category>(categorySchema.options);
    const networks = emptyCounts<Network>(networkSchema.options);
    for (const nft of base) {
      categories[nft.category]++;
      networks[nft.network]++;
    }
    const prices = all.map((nft) => new Decimal(toSummary(nft).priceEth));

    return HttpResponse.json<NftListResponse>({
      items: sorted.slice(start, start + params.pageSize).map((nft) => summaries.get(nft)!),
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
      facets: {
        categories,
        networks,
        priceRange: {
          min: prices.length ? Decimal.min(...prices).toFixed() : "0",
          max: prices.length ? Decimal.max(...prices).toFixed() : "0",
        },
      },
    });
  }),

  route<{ id: string }>("get", "/nfts/:id", "nfts.detail", ({ params }) =>
    HttpResponse.json(toDetail(findNft(params.id))),
  ),

  route<{ id: string }>("get", "/nfts/:id/related", "nfts.related", ({ params }) => {
    const nft = findNft(params.id);
    const items = db.state.nfts
      .filter((other) => other.collection === nft.collection && other.id !== nft.id)
      .slice(0, 5)
      .map(toSummary);
    return HttpResponse.json({ items });
  }),

  privateRoute("get", "/favorites", "favorites.list", ({ user }) =>
    HttpResponse.json<Favorites>({ nftIds: db.state.favorites[user.id] ?? [] }),
  ),

  privateRoute<{ nftId: string }>("put", "/favorites/:nftId", "favorites.add", ({ user, params }) => {
    findNft(params.nftId);
    const nftIds = db.write((draft) => {
      const current = draft.favorites[user.id] ?? [];
      draft.favorites[user.id] = current.includes(params.nftId) ? current : [...current, params.nftId];
      return draft.favorites[user.id];
    });
    return HttpResponse.json<Favorites>({ nftIds });
  }),

  privateRoute<{ nftId: string }>("delete", "/favorites/:nftId", "favorites.remove", ({ user, params }) => {
    const nftIds = db.write((draft) => {
      draft.favorites[user.id] = (draft.favorites[user.id] ?? []).filter((id) => id !== params.nftId);
      return draft.favorites[user.id];
    });
    return HttpResponse.json<Favorites>({ nftIds });
  }),
];
