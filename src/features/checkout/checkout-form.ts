import { z } from "zod";
import {
  buyerSchema,
  emailSchema,
  isValidAddress,
  networkSchema,
  walletTypeSchema,
  type UpsertWalletInput,
  type Wallet,
} from "@/api/contracts";

/**
 * Formulário do pagamento (Figma): dados do colecionador para o recibo + dados da carteira usada.
 * Os campos da carteira são os do contrato PUT /wallets/:slot; a regra de endereço por rede é a mesma.
 */
export const checkoutFormSchema = z
  .object({
    buyerDisplayName: buyerSchema.shape.displayName,
    email: emailSchema,
    note: z.string().trim().max(280, "Use no máximo 280 caracteres").optional(),
    walletDisplayName: z.string().trim().min(2, "Digite o nome do perfil").max(40),
    network: z.union([networkSchema, z.literal("")]).refine((value) => value !== "", "Selecione uma rede"),
    address: z.string().trim().min(1, "Digite o endereço da carteira"),
    ensName: z
      .string()
      .trim()
      .max(64)
      .refine((value) => !value || /^[a-z0-9-]+(\.eth)?$/i.test(value) || /^0x[a-fA-F0-9]{40}$/.test(value), "Use um nome ENS (nome.eth) ou um endereço 0x")
      .optional(),
    type: z.union([walletTypeSchema, z.literal("")]).refine((value) => value !== "", "Selecione uma carteira"),
    referralCode: z.string().trim().max(24).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.network && values.address && !isValidAddress(values.network, values.address)) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: values.network === "solana" ? "Endereço Solana inválido" : "Use um endereço 0x com 40 caracteres hexadecimais",
      });
    }
  });

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>;

export const emptyWalletFields = {
  walletDisplayName: "",
  network: "",
  address: "",
  ensName: "",
  type: "",
  referralCode: "",
} satisfies Partial<CheckoutFormValues>;

export function walletToFields(wallet: Wallet | null): Pick<CheckoutFormValues, keyof typeof emptyWalletFields> {
  if (!wallet) return emptyWalletFields;
  return {
    walletDisplayName: wallet.displayName,
    network: wallet.network,
    address: wallet.address,
    ensName: wallet.ensName ?? "",
    type: wallet.type,
    referralCode: wallet.referralCode ?? "",
  };
}

export function fieldsToWalletInput(values: CheckoutFormValues, current: Wallet | null): UpsertWalletInput {
  return {
    displayName: values.walletDisplayName,
    nickname: current?.nickname ?? undefined,
    network: values.network as UpsertWalletInput["network"],
    type: values.type as UpsertWalletInput["type"],
    address: values.address.trim(),
    ensName: values.ensName?.trim() || undefined,
    referralCode: values.referralCode?.trim() || undefined,
    email: current?.email ?? undefined,
  };
}

/** A carteira salva difere do formulário? Só então o checkout grava antes de conectar. */
export function walletChanged(values: CheckoutFormValues, wallet: Wallet | null) {
  if (!wallet) return true;
  const saved = walletToFields(wallet);
  return (Object.keys(saved) as (keyof typeof saved)[]).some((key) => (values[key] ?? "").trim() !== (saved[key] ?? "").trim());
}
