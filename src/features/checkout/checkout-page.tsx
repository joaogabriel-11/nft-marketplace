import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  quoteOutdatedDetailsSchema,
  type Quote,
  type QuoteOutdatedDetails,
  type Wallet,
  type WalletSlot,
  type WalletType,
} from "@/api/contracts";
import { isApiError } from "@/api/errors";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldShell, TextAreaControl, TextControl } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { CouponForm, MobileHeader, TotalsList } from "@/features/cart/cart-page";
import { cartBlockers, useCart } from "@/features/cart/queries";
import { formatEth, NETWORK_LABELS, shortAddress, WALLET_TYPE_LABELS } from "@/lib/format";
import { errorMessage } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  checkoutFormSchema,
  fieldsToWalletInput,
  walletChanged,
  walletToFields,
  type CheckoutFormValues,
} from "./checkout-form";
import { WalletFields } from "@/features/wallets/wallet-fields";
import { WALLET_FIELD_ERRORS } from "@/features/wallets/wallet-schema";
import { PendingOrderBanner } from "./pending-order-banner";
import { CREATE_ORDER_KEY, useConnectWallet, useCreateOrder, useCreateQuote, useDisconnectWallet, useSaveWallet, useWallets } from "./queries";
import { ReviewDialog } from "./review-dialog";
import { checkoutStorage } from "./storage";
import { useRealtime } from "@/lib/realtime/store";

/** Diferenças entre a cotação revisada e a nova, para o usuário confirmar o que mudou. */
function diffQuotes(previous: Quote, fresh: Quote): QuoteOutdatedDetails["changes"] {
  const changes: QuoteOutdatedDetails["changes"] = [];
  for (const item of previous.items) {
    const now = fresh.items.find((i) => i.editionId === item.editionId);
    if (!now) {
      changes.push({ type: "unavailable", nftId: item.nftId, editionId: item.editionId, message: `${item.name} não está mais disponível` });
    } else if (now.unitPriceEth !== item.unitPriceEth) {
      changes.push({
        type: "price_changed",
        nftId: item.nftId,
        editionId: item.editionId,
        message: `${item.name}: preço mudou de ${item.unitPriceEth} para ${now.unitPriceEth} ETH`,
      });
    } else if (now.quantity !== item.quantity) {
      changes.push({ type: "quantity_reduced", nftId: item.nftId, editionId: item.editionId, message: `${item.name}: quantidade ajustada para ${now.quantity}` });
    }
  }
  if (!changes.length && previous.totals.totalEth !== fresh.totals.totalEth) {
    changes.push({ type: "totals_changed", message: "O total foi atualizado." });
  }
  return changes;
}

type Step = "idle" | "saving" | "connecting" | "quoting";
interface Connection {
  walletId: string;
  connectionId: string;
}

const PROVIDERS: { type: WalletType; mark: string; caption?: string }[] = [
  { type: "walletconnect", mark: "W", caption: "METAMASK  •  WALLETCONNECT  •  COINBASE" },
  { type: "metamask", mark: "M" },
  { type: "coinbase", mark: "C" },
];

const STEP_LABEL: Record<Step, string> = {
  idle: "Confirmar compra",
  saving: "Salvando carteira…",
  connecting: "Conectando carteira…",
  quoting: "Calculando cotação…",
};

export function CheckoutPage() {
  const { user } = useSession();
  const cart = useCart();
  const wallets = useWallets();
  // Pedido em envio: o carrinho pode esvaziar antes da resposta (liquidação via tempo real).
  const submittingOrder = useIsMutating({ mutationKey: CREATE_ORDER_KEY }) > 0;

  if (cart.isPending || wallets.isPending) return <CheckoutSkeleton />;
  if (cart.isError || wallets.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-18 font-bold">Não conseguimos preparar o pagamento</p>
        <p className="text-14 text-text-secondary">{errorMessage(cart.error ?? wallets.error)}</p>
        <Button onClick={() => void Promise.all([cart.refetch(), wallets.refetch()])}>Tentar novamente</Button>
      </div>
    );
  }
  if (cart.data.items.length === 0 && submittingOrder) {
    return (
      <p role="status" className="py-16 text-center text-16 font-bold">
        Processando pagamento…
      </p>
    );
  }
  if (cart.data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <PendingOrderBanner />
        <p className="text-18 font-bold">Seu carrinho está vazio</p>
        <Link to="/" hash="catalogo" className={buttonVariants()}>
          Explorar NFTs
        </Link>
      </div>
    );
  }
  return <CheckoutForm key={user!.id} userId={user!.id} wallets={wallets.data} />;
}

function CheckoutForm({ userId, wallets }: { userId: string; wallets: { primary: Wallet | null; secondary: Wallet | null } }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const cart = useCart();
  const saveWallet = useSaveWallet();
  const connect = useConnectWallet();
  const disconnect = useDisconnectWallet();
  const createQuote = useCreateQuote();
  const createOrder = useCreateOrder();

  // Rascunho salvo (sessão expirada no meio do checkout): o usuário volta com tudo preenchido.
  const draft = useMemo(() => checkoutStorage.draft.get<CheckoutFormValues & { slot: WalletSlot }>(userId), [userId]);
  const [slot, setSlot] = useState<WalletSlot>(draft?.slot ?? (wallets.primary || !wallets.secondary ? "primary" : "secondary"));
  const wallet = wallets[slot];

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: draft ?? {
      buyerDisplayName: user?.displayName ?? "",
      email: user?.email ?? "",
      note: "",
      ...walletToFields(wallet),
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = form;
  const values = useWatch({ control: form.control });

  const [step, setStep] = useState<Step>("idle");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [changes, setChanges] = useState<QuoteOutdatedDetails["changes"]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!wallet);
  const [reviewWalletId, setReviewWalletId] = useState<string | null>(null);

  // Tempo real: um nft.updated de item da cotação aberta a torna desatualizada.
  // A API também rejeitaria a cotação antiga (409); aqui o usuário é avisado antes de tentar.
  const lastNftChange = useRealtime((state) => state.nftChanges.at(-1));
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const [handledChange, setHandledChange] = useState(lastNftChange);
  if (lastNftChange !== handledChange) {
    setHandledChange(lastNftChange);
    if (lastNftChange && quote && Date.parse(quote.createdAt) <= lastNftChange.at && quote.items.some((i) => i.nftId === lastNftChange.nftId)) {
      setStaleSince(lastNftChange.at);
    }
  }
  const quoteStale = staleSince !== null;

  async function refreshQuote() {
    if (!quote) return;
    const previous = quote;
    try {
      const fresh = await createQuote.mutateAsync();
      setQuote(fresh);
      setChanges(diffQuotes(previous, fresh));
      setStaleSince(null);
    } catch (error) {
      setStaleSince(null);
      handleQuoteError(error);
    }
  }

  useEffect(() => {
    checkoutStorage.draft.set(userId, { ...values, slot });
  }, [values, slot, userId]);

  // Mudou a carteira (endereço, rede ou tipo): a conexão anterior não vale mais.
  const connectedWallet = connection && (wallets.primary?.id === connection.walletId ? wallets.primary : wallets.secondary);
  const connectionValid = !!connection && !!connectedWallet && connectedWallet.id === wallet?.id && !walletChanged(getValues(), wallet);

  function chooseSlot(next: WalletSlot) {
    if (next === slot) return;
    setSlot(next);
    setConnection(null);
    setWalletError(null);
    const target = wallets[next];
    setShowForm(!target);
    reset({ ...getValues(), ...walletToFields(target) });
  }

  async function onDisconnect() {
    if (!connection) return;
    await disconnect.mutateAsync(connection.walletId).catch(() => undefined);
    setConnection(null);
    toast.info("Carteira desconectada.");
  }

  const onSubmit = handleSubmit(
    async (formValues) => {
      setWalletError(null);
      setOrderError(null);
      try {
        // 1. Carteira: grava só se o formulário diferir do cadastro.
        let target = wallet;
        if (walletChanged(formValues, wallet)) {
          setStep("saving");
          const saved = await saveWallet.mutateAsync({ slot, input: fieldsToWalletInput(formValues, wallet) });
          target = saved[slot];
        }
        if (!target) throw new Error("Carteira não encontrada");

        // 2. Conexão simulada com a extensão (pode ser recusada pelo usuário na carteira).
        let current = connection;
        if (!current || current.walletId !== target.id || !connectionValid) {
          setStep("connecting");
          try {
            const result = await connect.mutateAsync(target.id);
            current = { walletId: target.id, connectionId: result.connectionId };
            setConnection(current);
          } catch (error) {
            setWalletError(
              isApiError(error) && error.code === "wallet_rejected"
                ? "A conexão foi recusada na carteira. Aprove a solicitação e tente novamente."
                : errorMessage(error, "Não foi possível conectar a carteira."),
            );
            return;
          }
        }

        // 3. Cotação: a fotografia de preços que será revisada e confirmada.
        setStep("quoting");
        const fresh = await createQuote.mutateAsync();
        setQuote(fresh);
        setChanges([]);
        setStaleSince(null);
        setReviewWalletId(target.id);
        setReviewOpen(true);
      } catch (error) {
        handleQuoteError(error);
      } finally {
        setStep("idle");
      }
    },
    () => setShowForm(true),
  );

  function handleQuoteError(error: unknown) {
    if (isApiError(error) && (error.code === "insufficient_availability" || error.code === "cart_empty")) {
      const details = quoteOutdatedDetailsSchema.safeParse(error.details);
      setQuote(null);
      setChanges(details.success ? details.data.changes : []);
      setReviewOpen(true);
      return;
    }
    if (isApiError(error) && error.fieldErrors && Object.keys(error.fieldErrors).length) {
      setShowForm(true);
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const map: Record<string, keyof CheckoutFormValues> = { ...WALLET_FIELD_ERRORS, displayName: "buyerDisplayName" };
        if (map[field]) form.setError(map[field], { type: "server", message });
      }
      return;
    }
    toast.error(errorMessage(error));
  }

  function confirmOrder() {
    if (!quote || !connection || !reviewWalletId) return;
    const formValues = getValues();
    // Mesma cotação + carteira = mesma intenção = mesma chave (clique repetido, timeout, refresh).
    const attempt = checkoutStorage.attemptFor(userId, quote.id, reviewWalletId);
    setOrderError(null);
    createOrder.mutate(
      {
        idempotencyKey: attempt.idempotencyKey,
        input: {
          quoteId: quote.id,
          walletId: reviewWalletId,
          connectionId: connection.connectionId,
          network: formValues.network as Wallet["network"],
          buyer: {
            displayName: formValues.buyerDisplayName,
            email: formValues.email,
            note: formValues.note?.trim() || undefined,
          },
        },
      },
      {
        // Navegação e limpeza do rascunho ficam no onSuccess da mutation (useCreateOrder).
        onSuccess: () => setReviewOpen(false),
        onError: (error) => {
          if (isApiError(error) && (error.code === "quote_outdated" || error.code === "quote_expired")) {
            const details = quoteOutdatedDetailsSchema.safeParse(error.details);
            if (details.success) {
              setQuote(details.data.quote);
              setChanges(
                details.data.changes.length
                  ? details.data.changes
                  : [{ type: "totals_changed", message: error.code === "quote_expired" ? "A cotação expirou e foi recalculada." : "Os valores foram atualizados." }],
              );
              void cart.refetch();
              return;
            }
          }
          if (isApiError(error) && error.code === "wallet_not_connected") {
            setConnection(null);
            setReviewOpen(false);
            setWalletError("A conexão com a carteira foi perdida. Conecte novamente para concluir.");
            return;
          }
          setOrderError(
            isApiError(error) && error.isTransient
              ? "Não recebemos a confirmação do servidor. Tente novamente: o mesmo pedido será recuperado, sem cobrança duplicada."
              : errorMessage(error),
          );
        },
      },
    );
  }

  const blockers = cartBlockers(cart.data);
  const busy = step !== "idle" || createOrder.isPending;
  const network = values.network ? NETWORK_LABELS[values.network as Wallet["network"]] : null;

  return (
    <FormProvider {...form}>
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8" aria-labelledby="checkout-title">
      <MobileHeader title="Pagamento com carteira" />
      <nav aria-label="Trilha de navegação" className="hidden text-15 leading-4 font-bold md:block">
        <Link to="/" className="hover:text-text-accent">Início</Link> /{" "}
        <Link to="/" hash="catalogo" className="hover:text-text-accent">Mercado</Link> / Pagamento
      </nav>
      <h1 id="checkout-title" className="sr-only">
        Pagamento
      </h1>
      <PendingOrderBanner />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ----- Coluna esquerda: perfil do colecionador e carteira ----- */}
        <section aria-labelledby="buyer-title" className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Mobile: carteiras cadastradas como cards (Figma mobile). */}
          <div className="flex flex-col gap-4 md:hidden">
            <div className="flex items-center justify-between text-16 leading-4 font-bold">
              <span>{connectionValid ? "Carteira conectada" : "Sua carteira"}</span>
              <button type="button" className="text-text-accent" onClick={() => chooseSlot(slot === "primary" ? "secondary" : "primary")}>
                Trocar carteira
              </button>
            </div>
            <fieldset className="flex flex-col gap-5">
              <legend className="sr-only">Carteira usada no pagamento</legend>
              {(["secondary", "primary"] as const).map((key) => {
                const item = wallets[key];
                return (
                  <label
                    key={key}
                    className={cn(
                      "relative flex min-h-[93px] cursor-pointer items-center gap-5 rounded-[16px] border bg-surface-card px-5 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                      slot === key ? "border-primary" : "border-transparent",
                    )}
                  >
                    <input type="radio" name="wallet-slot" className="absolute inset-0 opacity-0" checked={slot === key} onChange={() => chooseSlot(key)} />
                    <span aria-hidden="true" className={cn("size-4 shrink-0 rounded-full border-2 border-primary", slot === key && "bg-primary shadow-[inset_0_0_0_3px_var(--color-surface-card)]")} />
                    <span className="flex flex-col gap-1.5">
                      <span className="text-16 leading-4 font-bold">{key === "primary" ? "Principal" : "Reserva"}</span>
                      <span className="text-14 leading-[22px] text-text-secondary">
                        {item ? (
                          <>
                            {item.ensName ?? shortAddress(item.address)}
                            <br />
                            Rede {NETWORK_LABELS[item.network]}
                          </>
                        ) : (
                          "Nenhuma carteira cadastrada. Toque para cadastrar."
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <button type="button" className="self-start text-14 text-text-accent underline-offset-4 hover:underline" aria-expanded={showForm} onClick={() => setShowForm((open) => !open)}>
              {showForm ? "Ocultar dados do pedido" : "Ver e editar dados do pedido"}
            </button>
          </div>

          <div className={cn("flex-col gap-3", showForm ? "flex" : "hidden md:flex")}>
            <h2 id="buyer-title" className="text-17 leading-4 font-bold">
              Perfil do colecionador
            </h2>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <FieldShell label="Nome de exibição" required error={errors.buyerDisplayName?.message}>
                {(a11y) => <TextControl {...a11y} autoComplete="name" {...register("buyerDisplayName")} />}
              </FieldShell>
              <FieldShell label="Nome de usuário" required hint="Vinculado à sua conta.">
                {(a11y) => <TextControl {...a11y} value={user?.username ?? ""} readOnly aria-readonly />}
              </FieldShell>
              {/* Rede, nome do perfil, endereço, ENS, tipo e indicação: as mesmas linhas da tela de Carteiras. */}
              <WalletFields />
              <FieldShell label="E-mail" required error={errors.email?.message}>
                {(a11y) => <TextControl {...a11y} type="email" autoComplete="email" {...register("email")} />}
              </FieldShell>
            </div>
            <label className="mt-3 hidden w-fit cursor-pointer items-center gap-2 text-15 md:flex">
              <input
                type="checkbox"
                className="size-[15px] appearance-none rounded-full border-2 border-primary checked:bg-primary checked:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                checked={slot === "secondary"}
                onChange={(event) => chooseSlot(event.target.checked ? "secondary" : "primary")}
              />
              Usar outra carteira?
              <span className="text-12 text-text-secondary">({slot === "secondary" ? "carteira secundária" : "carteira principal"})</span>
            </label>
            <FieldShell label="Observação do colecionador (opcional)" error={errors.note?.message} className="mt-3 md:max-w-[350px]">
              {(a11y) => <TextAreaControl {...a11y} maxLength={280} {...register("note")} />}
            </FieldShell>
          </div>
        </section>

        {/* ----- Coluna direita: itens, totais, carteira e rede ----- */}
        <section aria-labelledby="summary-title" className="flex flex-col gap-3 lg:w-[405px] lg:shrink-0">
          <h2 id="summary-title" className="text-17 leading-4 font-bold">
            Seus NFTs
          </h2>
          <div aria-hidden="true" className="flex justify-between border-b-[0.3px] border-foreground/40 pb-3 text-16 leading-4">
            <span className="font-bold">NFTs</span>
            <span className="font-medium">Subtotal</span>
          </div>
          <ul className="flex flex-col gap-3">
            {cart.data!.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 bg-surface-card py-0 pr-4 pl-1">
                <img src={item.imageUrl} alt="" width={70} height={70} className="size-[70px] rounded-[8px] object-cover" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 leading-4">
                  <span className="truncate text-16 font-bold">{item.name}</span>
                  <span className="text-14 text-secondary">ID do token: {item.tokenId}</span>
                </span>
                <span className="text-14 text-text-secondary">(x {item.quantity})</span>
                <span className="text-18 leading-4 font-bold text-text-accent">{formatEth(item.lineTotalEth)}</span>
              </li>
            ))}
          </ul>
          <details className="group text-center text-14">
            <summary className="cursor-pointer list-none py-1 hover:text-text-accent">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3 text-left">
              <CouponForm cart={cart.data!} />
            </div>
          </details>
          <TotalsList totals={cart.data!.totals} />

          <fieldset className="mt-4 flex flex-col gap-4">
            <legend className="mb-5 w-full text-center text-17 leading-4 font-bold max-md:text-left">Carteira e rede</legend>
            {PROVIDERS.map((provider) => {
              const selected = values.type === provider.type;
              return (
                <label
                  key={provider.type}
                  className={cn(
                    "relative flex h-[45px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 has-focus-visible:outline-2 has-focus-visible:outline-ring max-md:h-[65px] max-md:rounded-[12px] max-md:bg-surface-card",
                    selected ? "border-primary" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    className="absolute inset-0 opacity-0"
                    checked={selected}
                    onChange={() => setValue("type", provider.type, { shouldValidate: true, shouldDirty: true })}
                    aria-label={WALLET_TYPE_LABELS[provider.type]}
                  />
                  <span aria-hidden="true" className={cn("size-4 shrink-0 rounded-full border-2 border-primary md:order-none", selected && "bg-primary shadow-[inset_0_0_0_3px_var(--color-ink)]")} />
                  <span aria-hidden="true" className="hidden size-10 place-items-center rounded-full bg-surface-raised text-15 font-bold text-text-accent max-md:grid">
                    {provider.mark}
                  </span>
                  {provider.caption ? (
                    <span className="flex items-center gap-2">
                      <span className="text-15 md:hidden">{WALLET_TYPE_LABELS[provider.type]}</span>
                      <span className="hidden rounded-[6px] border border-border-soft bg-surface-dark px-2 py-1.5 text-9 font-bold tracking-[0.1px] whitespace-pre text-text-accent md:inline">
                        {provider.caption}
                      </span>
                    </span>
                  ) : (
                    <span className="text-15">{WALLET_TYPE_LABELS[provider.type]}</span>
                  )}
                </label>
              );
            })}
          </fieldset>

          <div role="status" aria-live="polite" className="text-13">
            {walletError ? (
              <p role="alert" className="rounded-[6px] border border-error/60 bg-error/10 px-4 py-3">
                {walletError}
              </p>
            ) : connectionValid && connectedWallet ? (
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-success/60 bg-success/10 px-4 py-3">
                <span>
                  Conectada: {WALLET_TYPE_LABELS[connectedWallet.type]} · {shortAddress(connectedWallet.address)}
                  {network ? ` · ${network}` : ""}
                </span>
                <button type="button" className="text-text-accent underline-offset-4 hover:underline" onClick={() => void onDisconnect()}>
                  Desconectar
                </button>
              </p>
            ) : (
              <p className="text-text-secondary">A carteira será conectada ao confirmar a compra.</p>
            )}
          </div>

          {blockers.length > 0 && (
            <p role="alert" className="text-13 text-coral">
              Alguns itens do carrinho mudaram.{" "}
              <Link to="/carrinho" className="underline">
                Revise o carrinho
              </Link>{" "}
              antes de pagar.
            </p>
          )}

          <p className="flex justify-end gap-6 text-16 leading-4 font-bold md:hidden">
            <span>Total:</span>
            <span className="text-text-accent">{formatEth(cart.data!.totals.totalEth)}</span>
          </p>
          <Button type="submit" className="h-[45px] w-full rounded-[8px] text-15 max-md:h-[60px] max-md:rounded-[10px]" disabled={busy || blockers.length > 0}>
            {STEP_LABEL[step]}
          </Button>
        </section>
      </div>

      <ReviewDialog
        open={reviewOpen}
        quote={quote}
        changes={changes}
        wallet={{
          type: (values.type || "metamask") as WalletType,
          address: values.address ?? "",
          network: (values.network || "ethereum") as Wallet["network"],
        }}
        submitting={createOrder.isPending}
        stale={quoteStale}
        refreshing={createQuote.isPending}
        onRefresh={() => void refreshQuote()}
        error={orderError}
        onConfirm={confirmOrder}
        onClose={() => setReviewOpen(false)}
        onBackToCart={() => void navigate({ to: "/carrinho" })}
      />
    </form>
    </FormProvider>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8 lg:flex-row">
      <p role="status" className="sr-only">
        Preparando pagamento…
      </p>
      <div className="grid flex-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[58px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:w-[405px]">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[70px] rounded-none" />
        ))}
        <Skeleton className="h-32" />
        <Skeleton className="h-[45px]" />
      </div>
    </div>
  );
}
