import { z } from "zod";

/**
 * Valor em ETH sempre como string decimal não negativa (até 18 casas, a precisão do wei).
 * Nunca trafega como number para não perder precisão; cálculos usam decimal.js.
 */
export const ethAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, "Valor em ETH inválido");
export type EthAmount = z.infer<typeof ethAmountSchema>;

export const isoDateSchema = z.iso.datetime({ offset: true });

export const idSchema = z.string().min(1);

export const quantitySchema = z.number().int().positive();

export const networkSchema = z.enum(["ethereum", "polygon", "solana"]);
export type Network = z.infer<typeof networkSchema>;

/** Códigos de erro estáveis; a UI decide a mensagem e o fluxo pelo código, não pelo status. */
export const apiErrorCodeSchema = z.enum([
  "validation_error",
  "unauthorized",
  "session_expired",
  "forbidden",
  "not_found",
  "conflict",
  "email_taken",
  "username_taken",
  "invalid_credentials",
  "invalid_password",
  "insufficient_availability",
  "edition_unavailable",
  "coupon_invalid",
  "coupon_expired",
  "cart_empty",
  "quote_outdated",
  "quote_expired",
  "idempotency_conflict",
  "wallet_rejected",
  "wallet_not_connected",
  "service_unavailable",
  "internal_error",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Erros por campo, com o mesmo nome do campo no payload enviado. */
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type Pagination = z.infer<typeof paginationSchema>;
