import { z } from "zod";
import { buyerSchema, emailSchema, type UpsertWalletInput, type Wallet } from "@/api/contracts";
import {
  refineWalletAddress,
  toWalletInput,
  walletFieldsShape,
  walletToFields,
  type WalletFieldValues,
} from "@/features/wallets/wallet-schema";

/**
 * Formulário do pagamento (Figma): dados do colecionador para o recibo + campos da carteira usada
 * (os mesmos da tela de Carteiras, em wallet-schema). Nome e e-mail vão para o recibo do pedido.
 */
export const checkoutFormSchema = z
  .object({
    buyerDisplayName: buyerSchema.shape.displayName,
    email: emailSchema,
    note: z.string().trim().max(280, "Use no máximo 280 caracteres").optional(),
    ...walletFieldsShape,
  })
  .superRefine(refineWalletAddress);

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>;

export { walletToFields };

/** Carteira nova criada no pagamento usa o nome do colecionador como nome de exibição. */
export function fieldsToWalletInput(values: CheckoutFormValues, current: Wallet | null): UpsertWalletInput {
  return toWalletInput(values as WalletFieldValues, {
    displayName: current?.displayName ?? values.buyerDisplayName,
    nickname: current?.nickname,
    email: current?.email,
  });
}

/** A carteira salva difere do formulário? Só então o checkout grava antes de conectar. */
export function walletChanged(values: CheckoutFormValues, wallet: Wallet | null) {
  if (!wallet) return true;
  const saved = walletToFields(wallet);
  return (Object.keys(saved) as (keyof WalletFieldValues)[]).some(
    (key) => ((values[key] as string | undefined) ?? "").trim() !== (saved[key] ?? "").trim(),
  );
}
