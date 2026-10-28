import { z } from "zod";

const envSchema = z.object({
  // Liga a camada MSW (REST + Socket.IO). Fica "true" também no deploy de demonstração.
  VITE_ENABLE_MOCKS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Base das chamadas REST. Relativa para funcionar em qualquer host com MSW.
  VITE_API_URL: z.string().min(1).default("/api"),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(`Variáveis de ambiente inválidas: ${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
