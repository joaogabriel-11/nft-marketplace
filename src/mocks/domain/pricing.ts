import Decimal from "decimal.js";
import type { Cart, CartItem, CartItemStatus, Coupon, QuoteItem, Totals } from "@/api/contracts";
import type { CartRecord, CouponRecord } from "../db/schema";
import { db } from "../db/store";
import { imageUrl, maxPerOrder } from "./catalog";

/** Taxa de rede fixa por pedido (valor do Figma). */
export const NETWORK_FEE_ETH = "0.016";
const ETH_DECIMALS = 6;

const eth = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(ETH_DECIMALS).toFixed();

export function findCoupon(code: string): { coupon: CouponRecord | undefined; expired: boolean } {
  const coupon = db.state.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  return { coupon, expired: !!coupon && Date.parse(coupon.expiresAt) <= Date.now() };
}

/** Cupom válido agora; um cupom que expirou depois de aplicado deixa de valer. */
export function activeCoupon(code: string | null): Coupon | null {
  if (!code) return null;
  const { coupon, expired } = findCoupon(code);
  if (!coupon || expired) return null;
  return { code: coupon.code, percentOff: coupon.percentOff, description: coupon.description };
}

export function computeTotals(lineTotals: Decimal.Value[], coupon: Coupon | null): Totals {
  const subtotal = lineTotals.reduce<Decimal>((sum, value) => sum.plus(value), new Decimal(0));
  const discount = coupon ? subtotal.mul(coupon.percentOff).div(100).toDecimalPlaces(ETH_DECIMALS) : new Decimal(0);
  const fee = lineTotals.length ? new Decimal(NETWORK_FEE_ETH) : new Decimal(0);
  return {
    subtotalEth: eth(subtotal),
    discountEth: eth(discount),
    networkFeeEth: eth(fee),
    totalEth: eth(subtotal.minus(discount).plus(fee)),
  };
}

/** Linhas do carrinho resolvidas contra o catálogo atual (preço e disponibilidade ao vivo). */
export function resolveCartItems(cart: CartRecord): CartItem[] {
  return cart.lines.flatMap((line) => {
    const nft = db.state.nfts.find((n) => n.id === line.nftId);
    const edition = nft?.editions.find((e) => e.id === line.editionId);
    if (!nft || !edition) return [];
    let status: CartItemStatus = "ok";
    if (edition.available === 0) status = "sold_out";
    else if (line.quantity > maxPerOrder(edition)) status = "quantity_exceeds";
    else if (!new Decimal(edition.priceEth).eq(line.addedUnitPriceEth)) status = "price_changed";
    return [
      {
        id: edition.id,
        nftId: nft.id,
        editionId: edition.id,
        name: nft.name,
        tokenId: nft.tokenId,
        imageUrl: imageUrl(nft.imageKey),
        editionLabel: edition.label,
        quantity: line.quantity,
        unitPriceEth: edition.priceEth,
        addedUnitPriceEth: line.addedUnitPriceEth,
        lineTotalEth: eth(new Decimal(edition.priceEth).mul(line.quantity)),
        available: edition.available,
        maxPerOrder: maxPerOrder(edition),
        status,
        nftVersion: nft.version,
      },
    ];
  });
}

export function toCart(cart: CartRecord): Cart {
  const items = resolveCartItems(cart);
  const coupon = activeCoupon(cart.couponCode);
  return {
    id: cart.id,
    items,
    coupon,
    totals: computeTotals(items.map((i) => i.lineTotalEth), coupon),
    version: cart.version,
    updatedAt: cart.updatedAt,
  };
}

export const toQuoteItem = (item: CartItem): QuoteItem => ({
  nftId: item.nftId,
  editionId: item.editionId,
  name: item.name,
  tokenId: item.tokenId,
  imageUrl: item.imageUrl,
  editionLabel: item.editionLabel,
  quantity: item.quantity,
  unitPriceEth: item.unitPriceEth,
  lineTotalEth: item.lineTotalEth,
});
