import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Use ao menos 3 caracteres")
  .max(24, "Use no máximo 24 caracteres")
  .regex(/^[a-z0-9_.]+$/i, "Use apenas letras, números, ponto e sublinhado");

// trim/lowercase antes da validação de formato (no zod 4 os checks rodam na ordem declarada).
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Digite um e-mail válido"));

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter ao menos 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .regex(/[a-z]/i, "Inclua ao menos uma letra")
  .regex(/\d/, "Inclua ao menos um número");

export const userSchema = z.object({
  id: idSchema,
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  createdAt: isoDateSchema,
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: isoDateSchema,
  user: userSchema,
});
export type Session = z.infer<typeof sessionSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Digite sua senha"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const registerInputSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerInputSchema>;
