import { z } from "zod";
import { emailSchema, passwordSchema, usernameSchema } from "./auth";

export const updateProfileInputSchema = z.object({
  displayName: z.string().trim().min(2, "Digite seu nome de exibição").max(40),
  username: usernameSchema,
  email: emailSchema,
  ensName: z
    .string()
    .trim()
    .max(64)
    .refine((value) => !value || /^[a-z0-9-]+$/i.test(value), "Use apenas letras, números e hífen")
    .optional(),
  walletNickname: z.string().trim().max(32).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Avatar enviado como data URL (o mock persiste no localStorage). */
export const updateAvatarInputSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, "Envie uma imagem PNG, JPG ou WEBP"),
});
export type UpdateAvatarInput = z.infer<typeof updateAvatarInputSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "Digite a senha atual"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
