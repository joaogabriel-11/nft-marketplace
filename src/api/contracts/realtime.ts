import { z } from "zod";
import { orderSchema } from "./checkout";
import { idSchema, isoDateSchema } from "./common";
import { editionSchema, nftSummarySchema } from "./nft";

/**
 * Envelope comum dos eventos Socket.IO. `eventId` identifica a entrega (deduplicação);
 * `resourceId` + `version` identificam o estado (descartar eventos antigos sem regredir).
 */
const envelope = {
  eventId: idSchema,
  resourceId: idSchema,
  version: z.number().int().nonnegative(),
  occurredAt: isoDateSchema,
};

export const nftUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal("nft.updated"),
  /** Estado completo do NFT após a mudança: card + edições (preço e disponibilidade). */
  payload: nftSummarySchema.extend({ editions: z.array(editionSchema) }),
});
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>;

export const orderUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal("order.updated"),
  /** Dono do pedido: o cliente descarta eventos que não sejam da sessão atual. */
  userId: idSchema,
  payload: orderSchema,
});
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>;

export const REALTIME_EVENTS = {
  nftUpdated: "nft.updated",
  orderUpdated: "order.updated",
} as const;
