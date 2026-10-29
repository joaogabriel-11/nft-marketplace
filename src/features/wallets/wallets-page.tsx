import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { emailSchema, type Wallet, type WalletSlot } from "@/api/contracts";
import { isApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FieldShell, TextControl } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveWallet, useWallets } from "@/features/checkout/queries";
import { errorMessage } from "@/lib/notify";
import { WalletFields } from "./wallet-fields";
import {
  refineWalletAddress,
  toWalletInput,
  WALLET_FIELD_ERRORS,
  walletFieldsShape,
  walletToFields,
} from "./wallet-schema";

const walletFormSchema = z
  .object({
    displayName: z.string().trim().min(2, "Digite o nome de exibição").max(40),
    nickname: z.string().trim().max(32, "Use no máximo 32 caracteres").optional(),
    email: z.literal("").or(emailSchema).optional(),
    ...walletFieldsShape,
  })
  .superRefine(refineWalletAddress);

type WalletFormValues = z.input<typeof walletFormSchema>;

const SLOT_TEXT: Record<WalletSlot, { title: string; empty: string; saved: string }> = {
  primary: {
    title: "Carteira principal",
    empty: "Você ainda não adicionou uma carteira principal.",
    saved: "Carteira principal salva.",
  },
  secondary: {
    title: "Carteira secundária",
    empty: "Você ainda não adicionou uma carteira secundária.",
    saved: "Carteira secundária salva.",
  },
};

function toFormValues(wallet: Wallet | null): WalletFormValues {
  return {
    displayName: wallet?.displayName ?? "",
    nickname: wallet?.nickname ?? "",
    email: wallet?.email ?? "",
    ...walletToFields(wallet),
  };
}

export function WalletsPage() {
  const wallets = useWallets();

  if (wallets.isPending) {
    return (
      <div aria-busy="true" className="grid gap-6 md:grid-cols-2">
        <p role="status" className="sr-only">
          Carregando carteiras…
        </p>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[65px]" />
        ))}
      </div>
    );
  }
  if (wallets.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4 rounded-[8px] bg-surface-card p-6">
        <p className="text-18 font-bold">Não conseguimos carregar suas carteiras</p>
        <p className="text-14 text-text-secondary">{errorMessage(wallets.error)}</p>
        <Button onClick={() => void wallets.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">Carteiras</h1>
      <WalletSection slot="primary" wallet={wallets.data.primary} primary={wallets.data.primary} />
      <WalletSection slot="secondary" wallet={wallets.data.secondary} primary={wallets.data.primary} />
    </div>
  );
}

function WalletSection({ slot, wallet, primary }: { slot: WalletSlot; wallet: Wallet | null; primary: Wallet | null }) {
  const [adding, setAdding] = useState(false);
  const text = SLOT_TEXT[slot];
  const titleId = `wallet-${slot}-title`;
  const open = !!wallet || adding;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-17 leading-4 font-bold">
            {text.title}
          </h2>
          {!open && (
            <Button variant="link" size="none" className="text-16 font-bold" onClick={() => setAdding(true)}>
              Adicionar
              <span className="sr-only"> {text.title.toLowerCase()}</span>
            </Button>
          )}
        </div>
        {slot === "primary" && (
          <p className="text-15 leading-[15px] text-text-secondary">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
          </p>
        )}
      </header>
      {open ? (
        <WalletForm key={wallet?.updatedAt ?? "new"} slot={slot} wallet={wallet} primary={primary} onCancel={wallet ? undefined : () => setAdding(false)} />
      ) : (
        <p className="rounded-[6px] border border-dashed border-border px-4 py-6 text-14 text-text-secondary">{text.empty}</p>
      )}
    </section>
  );
}

function WalletForm({
  slot,
  wallet,
  primary,
  onCancel,
}: {
  slot: WalletSlot;
  wallet: Wallet | null;
  primary: Wallet | null;
  onCancel?: () => void;
}) {
  const save = useSaveWallet();
  const form = useForm<WalletFormValues>({ resolver: zodResolver(walletFormSchema), defaultValues: toFormValues(wallet) });
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = form;
  const fieldId = `wallet-${slot}`;

  /** "Igual à carteira principal": copia os dados, menos o endereço (a API não aceita repetido). */
  function copyFromPrimary(checked: boolean) {
    if (!checked || !primary) return;
    reset({ ...toFormValues(primary), address: "", nickname: getValues("nickname") }, { keepDefaultValues: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        slot,
        input: toWalletInput(values as Parameters<typeof toWalletInput>[0], {
          displayName: values.displayName,
          nickname: values.nickname,
          email: values.email,
        }),
      });
      toast.success(SLOT_TEXT[slot].saved);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fieldErrors).length) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          const target = WALLET_FIELD_ERRORS[field];
          if (target) setError(target as keyof WalletFormValues, { type: "server", message });
        }
        return;
      }
      setError("root.server", { message: errorMessage(error) });
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${fieldId}-title`} className="flex flex-col gap-6">
        {errors.root?.server?.message && (
          <p role="alert" className="rounded-[6px] border border-error/60 bg-error/10 px-4 py-3 text-13">
            {errors.root.server.message}
          </p>
        )}
        {slot === "secondary" && primary && (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-15">
            <input
              type="checkbox"
              className="size-[15px] appearance-none rounded-full border-2 border-primary checked:bg-primary checked:shadow-[inset_0_0_0_2px_var(--color-ink)]"
              onChange={(event) => copyFromPrimary(event.target.checked)}
            />
            Igual à carteira principal
            <span className="text-12 text-text-secondary">(copia os dados; informe outro endereço)</span>
          </label>
        )}
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
          <FieldShell label="Nome de exibição" required error={errors.displayName?.message}>
            {(a11y) => <TextControl {...a11y} autoComplete="name" {...register("displayName")} />}
          </FieldShell>
          <FieldShell label="Apelido da carteira" error={errors.nickname?.message} hint="Opcional. Ex.: Cofre principal">
            {(a11y) => <TextControl {...a11y} {...register("nickname")} />}
          </FieldShell>
          <WalletFields />
          <FieldShell label="E-mail" error={errors.email?.message} hint="Opcional. Para avisos desta carteira.">
            {(a11y) => <TextControl {...a11y} type="email" autoComplete="email" {...register("email")} />}
          </FieldShell>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="min-w-[160px]" disabled={save.isPending || (!!wallet && !isDirty)}>
            {save.isPending ? "Salvando…" : "Salvar carteira"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={() => (reset(toFormValues(null)), onCancel())}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

