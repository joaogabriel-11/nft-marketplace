import Decimal from "decimal.js";
import type { Category, Network } from "@/api/contracts";
import { createRandom } from "../lib/crypto";
import type { EditionRecord, NftRecord } from "../db/schema";

/** Imagens disponíveis (exportadas do Figma no Bloco 2 para public/images/nfts). */
/** As 4 artes exportadas do Figma (public/images/nfts/<chave>-{512,1024}.webp). */
export const NFT_IMAGE_KEYS = ["emerald", "violet", "ivory", "golden"] as const;

interface BaseNft {
  name: string;
  imageKey: (typeof NFT_IMAGE_KEYS)[number];
  collection: string;
  category: Category;
  network: Network;
  basePrice: string;
  attributes: string[];
  editions: Array<"1/1" | "1/10" | "1/50" | "ABERTA">;
  /** Preço anterior exibido riscado no card (promoção). */
  compareAtPrice?: string;
  /** Sobrescreve a disponibilidade por rótulo (para cenários determinísticos). */
  available?: Partial<Record<"1/1" | "1/10" | "1/50" | "ABERTA", number>>;
}

// Os nove primeiros reproduzem os cards do Figma (nome e preço).
const FIGMA_NFTS: BaseNft[] = [
  {
    name: "Emerald Ape #042", imageKey: "emerald", collection: "Kurio Apes", category: "arte-digital",
    network: "ethereum", basePrice: "1.19", attributes: ["Óculos", "Esmeralda", "Raro"],
    editions: ["1/1", "1/10", "1/50", "ABERTA"], available: { "1/1": 1, "1/10": 3, "1/50": 40 },
  },
  {
    name: "Sage Nomad #009", imageKey: "violet", collection: "Kurio Apes", category: "colecionaveis",
    network: "ethereum", basePrice: "1.69", attributes: ["Chapéu", "Sálvia", "Incomum"],
    editions: ["1/1", "1/10", "1/50"],
  },
  {
    name: "Neon Vessel #552", imageKey: "ivory", collection: "Neon Nomads", category: "arte-3d",
    network: "polygon", basePrice: "1.99", compareAtPrice: "2.29", attributes: ["Néon", "Gola alta", "Raro"],
    editions: ["1/1", "1/10"], available: { "1/1": 0 },
  },
  {
    name: "Cosmic Bloom #118", imageKey: "violet", collection: "Cosmic Gardens", category: "generativo",
    network: "ethereum", basePrice: "1.29", attributes: ["Floral", "Cósmico", "Comum"],
    editions: ["1/10", "1/50", "ABERTA"],
  },
  {
    name: "Violet Nomad #314", imageKey: "violet", collection: "Neon Nomads", category: "fotografia",
    network: "solana", basePrice: "1.39", attributes: ["Moletom", "Violeta", "Incomum"],
    editions: ["1/10", "1/50"], available: { "1/10": 6, "1/50": 30 },
  },
  {
    name: "Ivory Baron #088", imageKey: "ivory", collection: "Kurio Apes", category: "colecionaveis",
    network: "ethereum", basePrice: "1.79", attributes: ["Terno", "Marfim", "Raro"],
    editions: ["1/1", "1/10", "1/50"], available: { "1/50": 12 },
  },
  {
    name: "Golden Beat #207", imageKey: "golden", collection: "Golden Frequencies", category: "musica",
    network: "polygon", basePrice: "0.99", attributes: ["Fones", "Dourado", "Comum"],
    editions: ["1/50", "ABERTA"],
  },
  {
    name: "Golden Signal #160", imageKey: "golden", collection: "Golden Frequencies", category: "musica",
    network: "solana", basePrice: "0.39", attributes: ["Fones", "Sinal", "Comum"],
    editions: ["1/50", "ABERTA"],
  },
  {
    name: "Jade Monarch #001", imageKey: "emerald", collection: "Kurio Apes", category: "arte-digital",
    network: "ethereum", basePrice: "2.29", attributes: ["Jaqueta", "Jade", "Lendário"],
    editions: ["1/1"], available: { "1/1": 0 },
  },
];

const ADJECTIVES = [
  "Amber", "Obsidian", "Crimson", "Lunar", "Solar", "Velvet", "Copper", "Silent", "Prism", "Rust",
  "Echo", "Drift", "Ember", "Frost", "Onyx", "Saffron", "Cobalt", "Quartz",
];
const NOUNS = [
  "Relic", "Pilot", "Voyager", "Oracle", "Monk", "Rider", "Architect", "Lens", "Garden", "Pulse",
  "Atlas", "Totem", "Cipher", "Harbor", "Ritual", "Signal",
];
const COLLECTIONS = ["Kurio Apes", "Neon Nomads", "Cosmic Gardens", "Golden Frequencies", "Urban Lens", "Mint Studio"];
const CATEGORIES: Category[] = [
  "arte-digital", "fotografia", "musica", "arte-3d", "colecionaveis", "generativo", "jogos", "assinaturas", "utilidade",
];
const NETWORKS: Network[] = ["ethereum", "polygon", "solana"];
const EDITION_SETS: BaseNft["editions"][] = [
  ["1/1"], ["1/1", "1/10"], ["1/10", "1/50"], ["1/50", "ABERTA"], ["1/1", "1/10", "1/50"], ["1/10", "1/50", "ABERTA"],
];
const TRAITS = ["Óculos", "Chapéu", "Jaqueta", "Fones", "Néon", "Dourado", "Prata", "Floral", "Pixel", "Holográfico"];
const RARITY = ["Comum", "Incomum", "Raro", "Lendário"];

const EDITION_RULES = {
  "1/1": { supply: 1, multiplier: "3" },
  "1/10": { supply: 10, multiplier: "1.6" },
  "1/50": { supply: 50, multiplier: "1" },
  ABERTA: { supply: null, multiplier: "1" },
} as const;

const NETWORK_NAMES: Record<Network, string> = { ethereum: "Ethereum", polygon: "Polygon", solana: "Solana" };

const OPEN_EDITION_STOCK = 999;
const CATALOG_SIZE = 45;
/** Data-base fixa: as fixtures não dependem do relógio real. */
const CATALOG_EPOCH = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 86_400_000;

const slugify = (name: string) =>
  name.toLowerCase().replace(/#/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * A edição mais barata do conjunto custa exatamente `basePrice` (o preço exibido no card)
 * e começa com estoque, salvo override; as mais raras custam proporcionalmente mais.
 */
function buildEditions(base: BaseNft, id: string, random: () => number): EditionRecord[] {
  const multipliers = base.editions.map((label) => new Decimal(EDITION_RULES[label].multiplier));
  const cheapest = Decimal.min(...multipliers);
  return base.editions.map((label, index) => {
    const rule = EDITION_RULES[label];
    const isCheapest = multipliers[index].eq(cheapest);
    const randomAvailable =
      rule.supply === null ? OPEN_EDITION_STOCK : rule.supply === 1 ? (random() < 0.7 ? 1 : 0) : Math.floor(random() * rule.supply);
    return {
      id: `${id}--${label === "ABERTA" ? "aberta" : label.replace("/", "-")}`,
      label,
      supply: rule.supply,
      available: base.available?.[label] ?? (isCheapest ? Math.max(1, randomAvailable) : randomAvailable),
      priceEth: new Decimal(base.basePrice).mul(multipliers[index]).div(cheapest).toDecimalPlaces(4).toFixed(),
    };
  });
}

export function buildNftFixtures(): NftRecord[] {
  const random = createRandom(20261028);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];

  const generated: BaseNft[] = [];
  for (let i = 0; generated.length < CATALOG_SIZE - FIGMA_NFTS.length; i++) {
    const name = `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[(i * 7) % NOUNS.length]} #${String(200 + i * 13).padStart(3, "0")}`;
    // Preço entre 0.02 e 12.30, concentrado abaixo de 3 ETH.
    const price = new Decimal(random() < 0.8 ? 0.02 + random() * 2.98 : 3 + random() * 9.3).toDecimalPlaces(2);
    generated.push({
      name,
      imageKey: NFT_IMAGE_KEYS[i % NFT_IMAGE_KEYS.length],
      collection: pick(COLLECTIONS),
      category: CATEGORIES[i % CATEGORIES.length],
      network: pick(NETWORKS),
      basePrice: price.toFixed(),
      attributes: [pick(TRAITS), pick(TRAITS), pick(RARITY)].filter((v, idx, arr) => arr.indexOf(v) === idx),
      editions: pick(EDITION_SETS),
    });
  }
  // Extremos da faixa de preço do Figma (0,02 – 12,30 ETH).
  generated[0].basePrice = "0.02";
  generated[1].basePrice = "12.3";
  generated[1].editions = ["1/50"];

  return [...FIGMA_NFTS, ...generated].map((base, index) => {
    const id = slugify(base.name);
    const tokenNumber = base.name.split("#")[1] ?? String(index);
    return {
      id,
      tokenId: `#${tokenNumber.padStart(4, "0")}`,
      name: base.name,
      collection: base.collection,
      category: base.category,
      network: base.network,
      imageKey: base.imageKey,
      compareAtPriceEth: base.compareAtPrice ?? null,
      // Textos no formato do Figma (resumo curto + descrição em dois parágrafos).
      summary: `Um colecionável digital finalizado à mão da coleção ${base.collection}, verificado na ${NETWORK_NAMES[base.network]}, com arte desbloqueável e acesso para colecionadores.`,
      description: [
        `${base.name} é uma obra digital finalizada à mão da coleção ${base.collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${NETWORK_NAMES[base.network]}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      attributes: base.attributes,
      contractAddress: `0x${Array.from({ length: 40 }, () => Math.floor(random() * 16).toString(16)).join("")}`,
      royaltyPercent: 5,
      // O primeiro card reproduz o Figma: 4.8 com 19 avaliações.
      rating: index === 0 ? 4.8 : Math.round((3.8 + random() * 1.2) * 10) / 10,
      reviewsCount: index === 0 ? 19 : 3 + Math.floor(random() * 40),
      // Mais recentes primeiro, um dia entre cada listagem.
      listedAt: new Date(CATALOG_EPOCH - index * DAY).toISOString(),
      isNew: index < 12,
      trendingScore: Math.floor(random() * 1000),
      editions: buildEditions(base, id, random),
      version: 1,
    };
  });
}
