import { z } from "zod";
import { ethAmountSchema, idSchema, isoDateSchema, quantitySchema } from "./common";

export const cartItemStatusSchema = z.enum([
  "ok",
  /** Preço atual diferente do preço no momento em que o item entrou no carrinho. */
  "price_changed",
  /** Quantidade no carrinho maior que a disponibilidade atual. */
  "quantity_exceeds",
  "sold_out",
]);
export type CartItemStatus = z.infer<typeof cartItemStatusSchema>;

export const cartItemSchema = z.object({
  id: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  editionLabel: z.string(),
  quantity: quantitySchema,
  unitPriceEth: ethAmountSchema,
  addedUnitPriceEth: ethAmountSchema,
  lineTotalEth: ethAmountSchema,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().nonnegative(),
  status: cartItemStatusSchema,
  nftVersion: z.number().int().nonnegative(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const couponSchema = z.object({
  code: z.string(),
  percentOff: z.number().positive().max(100),
  description: z.string(),
});
export type Coupon = z.infer<typeof couponSchema>;

export const totalsSchema = z.object({
  subtotalEth: ethAmountSchema,
  discountEth: ethAmountSchema,
  networkFeeEth: ethAmountSchema,
  totalEth: ethAmountSchema,
});
export type Totals = z.infer<typeof totalsSchema>;

export const cartSchema = z.object({
  id: idSchema,
  items: z.array(cartItemSchema),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  /** Incrementa a cada alteração; a cotação registra a versão em que foi gerada. */
  version: z.number().int().nonnegative(),
  updatedAt: isoDateSchema,
});
export type Cart = z.infer<typeof cartSchema>;

export const addCartItemInputSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
});
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>;

export const updateCartItemInputSchema = z.object({ quantity: quantitySchema });
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

export const applyCouponInputSchema = z.object({
  code: z.string().trim().min(1, "Digite o código promocional").max(32),
});
export type ApplyCouponInput = z.infer<typeof applyCouponInputSchema>;

export const mergeCartInputSchema = z.object({ guestCartId: idSchema });
export type MergeCartInput = z.infer<typeof mergeCartInputSchema>;
