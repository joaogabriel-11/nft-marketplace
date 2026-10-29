import { useFormContext, type FieldErrors } from "react-hook-form";
import { FieldShell, SelectControl, TextControl } from "@/components/ui/field";
import { WALLET_TYPE_LABELS } from "@/lib/format";
import type { WalletFieldValues } from "./wallet-schema";

/**
 * Linhas de carteira compartilhadas (Figma: pagamento e Carteiras): Rede | Nome do perfil,
 * Endereço | ENS, Tipo | Código de indicação. Renderiza dentro de um grid de 2 colunas do
 * formulário pai, via FormProvider (cada tela tem seu próprio schema por cima destes campos).
 */
export function WalletFields() {
  const {
    register,
    formState: { errors: allErrors },
  } = useFormContext<WalletFieldValues>();
  const errors = allErrors as FieldErrors<WalletFieldValues>;

  return (
    <>
      <FieldShell label="Rede" required error={errors.network?.message}>
        {(a11y) => (
          <SelectControl {...a11y} required {...register("network")}>
            <option value="">Selecione uma rede</option>
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
            <option value="solana">Solana</option>
          </SelectControl>
        )}
      </FieldShell>
      <FieldShell label="Nome do perfil" required error={errors.profileName?.message}>
        {(a11y) => <TextControl {...a11y} autoComplete="nickname" {...register("profileName")} />}
      </FieldShell>
      <FieldShell label="Endereço da carteira" required error={errors.address?.message}>
        {(a11y) => (
          <TextControl {...a11y} placeholder="Endereço 0x da carteira" autoComplete="off" spellCheck={false} {...register("address")} />
        )}
      </FieldShell>
      <FieldShell label="ENS ou carteira secundária" error={errors.ensName?.message} hint="Opcional. Ex.: nome.eth">
        {(a11y) => <TextControl {...a11y} placeholder="ENS ou carteira secundária (opcional)" {...register("ensName")} />}
      </FieldShell>
      <FieldShell label="Tipo de carteira" required error={errors.type?.message}>
        {(a11y) => (
          <SelectControl {...a11y} required {...register("type")}>
            <option value="">Selecione uma carteira</option>
            {(Object.keys(WALLET_TYPE_LABELS) as (keyof typeof WALLET_TYPE_LABELS)[]).map((type) => (
              <option key={type} value={type}>
                {WALLET_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectControl>
        )}
      </FieldShell>
      <FieldShell label="Código de indicação" error={errors.referralCode?.message} hint="Opcional.">
        {(a11y) => <TextControl {...a11y} autoComplete="off" {...register("referralCode")} />}
      </FieldShell>
    </>
  );
}
