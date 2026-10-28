import { z } from "zod";
import { emailSchema } from "./auth";
import { couponSchema, totalsSchema } from "./cart";
import {
  ethAmountSchema,
  idSchema,
  isoDateSchema,
  networkSchema,
  quantitySchema,
} from "./common";
import { walletTypeSchema } from "./wallets";

export const quoteItemSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  editionLabel: z.string(),
  quantity: quantitySchema,
  unitPriceEth: ethAmountSchema,
  lineTotalEth: ethAmountSchema,
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;

/** Cotação: fotografia de preços, cupom e taxas que o pedido precisa referenciar. */
export const quoteSchema = z.object({
  id: idSchema,
  cartVersion: z.number().int().nonnegative(),
  items: z.array(quoteItemSchema).min(1),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema,
});
export type Quote = z.infer<typeof quoteSchema>;

/** Corpo do 409 quote_outdated: a cotação nova e o que mudou, para exigir nova confirmação. */
export const quoteOutdatedDetailsSchema = z.object({
  quote: quoteSchema.nullable(),
  changes: z.array(
    z.object({
      type: z.enum(["price_changed", "unavailable", "quantity_reduced", "coupon_invalid", "totals_changed"]),
      nftId: idSchema.optional(),
      editionId: idSchema.optional(),
      message: z.string(),
    }),
  ),
});
export type QuoteOutdatedDetails = z.infer<typeof quoteOutdatedDetailsSchema>;

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, "Digite seu nome de exibição").max(40),
  email: emailSchema,
  note: z.string().trim().max(280).optional(),
});

export const createOrderInputSchema = z.object({
  quoteId: idSchema,
  walletId: idSchema,
  connectionId: idSchema,
  network: networkSchema,
  buyer: buyerSchema,
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const orderStatusSchema = z.enum(["pending", "confirmed", "rejected"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** Pedido com snapshot completo: o recibo não muda se o catálogo mudar depois. */
export const orderSchema = z.object({
  id: idSchema,
  status: orderStatusSchema,
  items: z.array(quoteItemSchema).min(1),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  network: networkSchema,
  wallet: z.object({
    id: idSchema,
    type: walletTypeSchema,
    address: z.string(),
    nickname: z.string().nullable(),
  }),
  buyer: buyerSchema,
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  version: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderListSchema = z.object({ items: z.array(orderSchema) });
export type OrderList = z.infer<typeof orderListSchema>;
