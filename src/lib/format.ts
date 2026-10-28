import Decimal from "decimal.js";
import type { Category, Network, WalletType } from "@/api/contracts";

/** "1.19" → "1.19 ETH". Mantém a precisão da API (string), sem converter para number. */
export function formatEth(value: string) {
  return `${new Decimal(value).toFixed()} ETH`;
}

/** Faixa de preço do filtro no formato do Figma: "0,02 - 12,30 ETH". */
export function formatEthRange(min: string, max: string) {
  const br = (value: string) => new Decimal(value).toFixed(2).replace(".", ",");
  return `${br(min)} - ${br(max)} ETH`;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  "arte-digital": "Arte digital",
  fotografia: "Fotografia",
  musica: "Música",
  "arte-3d": "Arte 3D",
  colecionaveis: "Colecionáveis",
  generativo: "Generativa",
  jogos: "Jogos",
  assinaturas: "Assinaturas",
  utilidade: "Utilidade",
};

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
};

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  metamask: "MetaMask",
  walletconnect: "WalletConnect",
  coinbase: "Coinbase Wallet",
};

/** Artes servidas em 512 e 1024 px: deriva o srcset da URL base da API. */
export function nftImageSrcSet(url: string) {
  return url.endsWith("-512.webp") ? `${url} 512w, ${url.replace("-512.webp", "-1024.webp")} 1024w` : undefined;
}

/** "0x7A42f…19E8" — endereço encurtado como no Figma. */
export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}
