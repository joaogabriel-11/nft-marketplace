import Decimal from "decimal.js";
import type { Edition, NftDetail, NftSummary } from "@/api/contracts";
import type { EditionRecord, NftRecord } from "../db/schema";
import { db } from "../db/store";
import { notFound } from "../lib/http";

const LIMITED_MAX_PER_ORDER = 10;
const OPEN_MAX_PER_ORDER = 20;

/** URL base da arte (512 px); a UI deriva o srcset de 1024 px pela mesma convenção. */
export const imageUrl = (key: string) => `/images/nfts/${key}-512.webp`;

const RARE_ATTRIBUTES = ["Raro", "Lendário"];

const GALLERY_VIEWS = [
  { view: "full", label: "obra completa" },
  { view: "top", label: "detalhe superior" },
  { view: "center", label: "detalhe central" },
  { view: "bottom", label: "detalhe inferior" },
] as const;

export function maxPerOrder(edition: EditionRecord) {
  const cap = edition.supply === null ? OPEN_MAX_PER_ORDER : LIMITED_MAX_PER_ORDER;
  return Math.min(edition.available, cap);
}

/** Menor preço entre edições disponíveis; se todas esgotaram, o da primeira. */
export function displayPrice(nft: NftRecord) {
  const available = nft.editions.filter((e) => e.available > 0);
  const pool = available.length ? available : nft.editions;
  return Decimal.min(...pool.map((e) => e.priceEth)).toFixed();
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    tokenId: nft.tokenId,
    name: nft.name,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    imageUrl: imageUrl(nft.imageKey),
    priceEth: displayPrice(nft),
    compareAtPriceEth: nft.compareAtPriceEth,
    isRare: nft.attributes.some((a) => RARE_ATTRIBUTES.includes(a)),
    available: nft.editions.some((e) => e.available > 0),
    isNew: nft.isNew,
    listedAt: nft.listedAt,
    version: nft.version,
  };
}

export function toEdition(edition: EditionRecord): Edition {
  return { ...edition, maxPerOrder: maxPerOrder(edition) };
}

export function toDetail(nft: NftRecord): NftDetail {
  return {
    ...toSummary(nft),
    summary: nft.summary,
    description: nft.description,
    images: GALLERY_VIEWS.map(({ view, label }) => ({
      url: imageUrl(nft.imageKey),
      alt: `${nft.name}, ${label}`,
      view,
    })),
    attributes: nft.attributes,
    contractAddress: nft.contractAddress,
    royaltyPercent: nft.royaltyPercent,
    rating: nft.rating,
    reviewsCount: nft.reviewsCount,
    editions: nft.editions.map(toEdition),
  };
}

export function findNft(id: string) {
  return db.state.nfts.find((n) => n.id === id) ?? notFound("NFT");
}

export function findEdition(nftId: string, editionId: string) {
  const nft = findNft(nftId);
  const edition = nft.editions.find((e) => e.id === editionId) ?? notFound("Edição");
  return { nft, edition };
}
