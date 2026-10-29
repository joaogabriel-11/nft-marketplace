import { z } from "zod";
import {
  isValidAddress,
  networkSchema,
  walletTypeSchema,
  type Network,
  type UpsertWalletInput,
  type Wallet,
  type WalletType,
} from "@/api/contracts";

/**
 * Campos de carteira comuns ao pagamento e à tela de Carteiras (mesmas linhas no Figma):
 * rede, nome do perfil, endereço, ENS, tipo e código de indicação. As mensagens são da interface;
 * o contrato (PUT /wallets/:slot) revalida tudo no servidor.
 */
export const walletFieldsShape = {
  network: z.union([networkSchema, z.literal("")]).refine((value) => value !== "", "Selecione uma rede"),
  profileName: z.string().trim().min(2, "Digite o nome do perfil").max(40),
  address: z.string().trim().min(1, "Digite o endereço da carteira"),
  ensName: z
    .string()
    .trim()
    .max(64)
    .refine(
      (value) => !value || /^[a-z0-9-]+(\.eth)?$/i.test(value) || /^0x[a-fA-F0-9]{40}$/.test(value),
      "Use um nome ENS (nome.eth) ou um endereço 0x",
    )
    .optional(),
  type: z.union([walletTypeSchema, z.literal("")]).refine((value) => value !== "", "Selecione uma carteira"),
  referralCode: z.string().trim().max(24, "Use no máximo 24 caracteres").optional(),
};

export interface WalletFieldValues {
  network: Network | "";
  profileName: string;
  address: string;
  ensName?: string;
  type: WalletType | "";
  referralCode?: string;
}

/** Endereço válido para a rede escolhida (mesma regra do contrato). */
export function refineWalletAddress(values: { network: Network | ""; address: string }, ctx: z.RefinementCtx) {
  if (values.network && values.address && !isValidAddress(values.network, values.address.trim())) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: values.network === "solana" ? "Endereço Solana inválido" : "Use um endereço 0x com 40 caracteres hexadecimais",
    });
  }
}

export const emptyWalletFields: WalletFieldValues = {
  network: "",
  profileName: "",
  address: "",
  ensName: "",
  type: "",
  referralCode: "",
};

export function walletToFields(wallet: Wallet | null): WalletFieldValues {
  if (!wallet) return emptyWalletFields;
  return {
    network: wallet.network,
    profileName: wallet.profileName ?? wallet.displayName,
    address: wallet.address,
    ensName: wallet.ensName ?? "",
    type: wallet.type,
    referralCode: wallet.referralCode ?? "",
  };
}

/** Monta o corpo do PUT a partir dos campos comuns + os específicos de cada tela. */
export function toWalletInput(
  values: WalletFieldValues,
  extra: { displayName: string; nickname?: string | null; email?: string | null },
): UpsertWalletInput {
  return {
    displayName: extra.displayName,
    profileName: values.profileName.trim() || undefined,
    nickname: extra.nickname?.trim() || undefined,
    network: values.network as UpsertWalletInput["network"],
    type: values.type as UpsertWalletInput["type"],
    address: values.address.trim(),
    ensName: values.ensName?.trim() || undefined,
    referralCode: values.referralCode?.trim() || undefined,
    email: extra.email?.trim() || undefined,
  };
}

/** Nomes de campo da API → campos do formulário (erros 409/422 por campo). */
export const WALLET_FIELD_ERRORS: Record<string, keyof WalletFieldValues | "displayName"> = {
  address: "address",
  network: "network",
  type: "type",
  profileName: "profileName",
  ensName: "ensName",
  referralCode: "referralCode",
  displayName: "displayName",
};
