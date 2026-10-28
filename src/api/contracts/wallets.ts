import { z } from "zod";
import { emailSchema } from "./auth";
import { idSchema, isoDateSchema, networkSchema, type Network } from "./common";

export const walletTypeSchema = z.enum(["metamask", "walletconnect", "coinbase"]);
export type WalletType = z.infer<typeof walletTypeSchema>;

export const walletSlotSchema = z.enum(["primary", "secondary"]);
export type WalletSlot = z.infer<typeof walletSlotSchema>;

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidAddress(network: Network, address: string) {
  return network === "solana" ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address);
}

export const walletSchema = z.object({
  id: idSchema,
  slot: walletSlotSchema,
  displayName: z.string(),
  nickname: z.string().nullable(),
  network: networkSchema,
  type: walletTypeSchema,
  address: z.string(),
  ensName: z.string().nullable(),
  referralCode: z.string().nullable(),
  email: z.string().nullable(),
  updatedAt: isoDateSchema,
});
export type Wallet = z.infer<typeof walletSchema>;

export const walletsSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
});
export type Wallets = z.infer<typeof walletsSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const upsertWalletInputSchema = z
  .object({
    displayName: z.string().trim().min(2, "Digite o nome de exibição").max(40),
    nickname: optionalText(32),
    network: networkSchema,
    type: walletTypeSchema,
    address: z.string().trim().min(1, "Digite o endereço da carteira"),
    ensName: optionalText(64).refine((value) => !value || /^[a-z0-9-]+(\.eth)?$/i.test(value), {
      message: "Nome ENS inválido",
    }),
    referralCode: optionalText(24),
    email: z.literal("").transform(() => undefined).or(emailSchema).optional(),
  })
  .superRefine((input, ctx) => {
    if (!isValidAddress(input.network, input.address)) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message:
          input.network === "solana"
            ? "Endereço Solana inválido"
            : "Use um endereço 0x com 40 caracteres hexadecimais",
      });
    }
  });
export type UpsertWalletInput = z.input<typeof upsertWalletInputSchema>;

export const walletConnectionSchema = z.object({
  connectionId: idSchema,
  walletId: idSchema,
  status: z.literal("connected"),
  connectedAt: isoDateSchema,
});
export type WalletConnection = z.infer<typeof walletConnectionSchema>;
