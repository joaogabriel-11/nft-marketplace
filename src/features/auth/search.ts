import { z } from "zod";

/** Search params de /login e /cadastro: destino após autenticar e motivo da ida ao login. */
export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(["expired"]).optional().catch(undefined),
});
