import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { Cart, CartItem, NftSummary } from "@/api/contracts";
import { isApiError } from "@/api/errors";
import deleteIcon from "@/assets/icons/delete.svg";
import arrowLeft from "@/assets/icons/m-arrow-left.svg";
import { Button, buttonVariants } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { NftCard, NftCardSkeleton } from "@/features/catalog/nft-card";
import { nftListQueryOptions } from "@/features/catalog/queries";
import { PendingOrderBanner } from "@/features/checkout/pending-order-banner";
import { useFavorites, useToggleFavorite } from "@/features/nft/favorites";
import { formatEth } from "@/lib/format";
import { errorMessage } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { cartBlockers, useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "./queries";

const QUANTITY_DEBOUNCE_MS = 350;

export function CartPage() {
  const cart = useCart();
  const { user } = useSession();
  const navigate = useNavigate();
  const blockers = cartBlockers(cart.data);
  const isEmpty = cart.data?.items.length === 0;

  function checkout() {
    if (!user) {
      toast.info("Entre para finalizar a compra. Seus itens continuam no carrinho.");
      void navigate({ to: "/login", search: { redirect: "/pagamento" } });
      return;
    }
    void navigate({ to: "/pagamento" });
  }

  return (
    <div className="flex flex-col gap-12 md:gap-24">
      <section aria-labelledby="cart-title" className="flex flex-col gap-3">
        <MobileHeader title="Carrinho de NFTs" />
        <nav aria-label="Trilha de navegação" className="hidden text-15 leading-4 font-bold md:block">
          <Link to="/" className="hover:text-text-accent">Início</Link> /{" "}
          <Link to="/" hash="catalogo" className="hover:text-text-accent">Mercado</Link> / Carrinho
        </nav>
        <h1 id="cart-title" className="sr-only">
          Carrinho de NFTs
        </h1>
        <PendingOrderBanner />

        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError ? (
          <div role="alert" className="flex flex-col items-center gap-4 rounded-[8px] bg-surface-card px-6 py-16 text-center">
            <p className="text-18 font-bold">Não conseguimos carregar seu carrinho</p>
            <p className="text-14 text-text-secondary">{errorMessage(cart.error)}</p>
            <Button onClick={() => void cart.refetch()}>Tentar novamente</Button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-4 rounded-[8px] bg-surface-card px-6 py-16 text-center">
            <p className="text-18 font-bold">Seu carrinho está vazio</p>
            <p className="text-14 text-text-secondary">Explore o mercado e adicione edições dos NFTs que você quer colecionar.</p>
            <Link to="/" hash="catalogo" className={buttonVariants()}>
              Explorar NFTs
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <CartTable cart={cart.data} />
            <CartSummary cart={cart.data} blocked={blockers.length > 0} onCheckout={checkout} />
          </div>
        )}
      </section>
      <AlsoViewed cart={cart.data} />
    </div>
  );
}

export function MobileHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="-mt-2 mb-2 flex items-center gap-4 md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: "/" }))}
        className="grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised"
      >
        <img src={arrowLeft} alt="" width={13} height={7} className="rotate-90" />
      </button>
      <p aria-hidden="true" className="flex-1 pr-[51px] text-center text-16 leading-4 font-bold">
        {title}
      </p>
    </div>
  );
}

function CartTable({ cart }: { cart: Cart }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[782px]">
      <div aria-hidden="true" className="hidden grid-cols-[250px_1fr_1fr_87px_24px] items-center gap-4 pr-6 text-16 leading-4 md:grid">
        <span className="font-bold">NFTs</span>
        <span className="font-medium">Preço</span>
        <span className="font-bold">Edições</span>
        <span className="font-medium">Total</span>
        <span />
      </div>
      <div aria-hidden="true" className="hidden h-[0.3px] bg-foreground/40 md:block" />
      <ul aria-label="Itens do carrinho" className="flex flex-col gap-3 md:gap-3">
        {cart.items.map((item) => (
          <CartRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const [draft, setDraft] = useState(item.quantity);
  const [synced, setSynced] = useState(item.quantity);
  const statusId = useId();

  // Quantidade mudou fora da linha (resposta da API, evento): o rascunho acompanha.
  if (item.quantity !== synced) {
    setSynced(item.quantity);
    setDraft(item.quantity);
  }

  // Cliques seguidos no +/− viram uma única requisição com o valor final.
  const { mutate: mutateQuantity } = update;
  useEffect(() => {
    if (draft === item.quantity) return;
    const timer = window.setTimeout(() => {
      mutateQuantity(
        { itemId: item.id, quantity: draft },
        {
          onError: (error) => {
            setDraft(item.quantity);
            toast.error(errorMessage(error, "Não foi possível alterar a quantidade."));
          },
        },
      );
    }, QUANTITY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, item.id, item.quantity, mutateQuantity]);

  function removeItem() {
    remove.mutate(item.id, {
      onSuccess: () => toast.success(`${item.name} (${item.editionLabel}) saiu do carrinho.`),
      onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o item.")),
    });
  }

  const max = Math.max(item.maxPerOrder, item.quantity);
  const warning = itemWarning(item);
  const busy = update.isPending || draft !== item.quantity;

  return (
    <li
      aria-describedby={warning ? statusId : undefined}
      className={cn("flex flex-col bg-surface-card max-md:rounded-[12px]", warning && "ring-1 ring-coral/70")}
    >
      <div className="grid grid-cols-[100px_1fr_auto] items-center gap-x-3 pr-4 md:h-[70px] md:grid-cols-[250px_1fr_1fr_87px_24px] md:gap-4 md:pr-6">
        <div className="row-span-2 flex items-center gap-4 md:row-span-1">
          <img
            src={item.imageUrl}
            alt=""
            width={70}
            height={70}
            loading="lazy"
            className="size-[100px] rounded-[12px] object-cover md:size-[70px] md:rounded-[6px]"
          />
          <div className="hidden min-w-0 flex-col gap-1.5 text-16 leading-4 md:flex">
            <Link to="/nfts/$id" params={{ id: item.nftId }} className="truncate font-bold hover:text-text-accent">
              {item.name}
            </Link>
            <span className="text-14 text-secondary">ID do token: {item.tokenId}</span>
          </div>
        </div>
        {/* Mobile: nome, edição e preço empilhados ao lado da imagem (Figma mobile). */}
        <div className="flex min-w-0 flex-col gap-1.5 py-3 md:hidden">
          <Link to="/nfts/$id" params={{ id: item.nftId }} className="truncate text-16 leading-4 font-bold">
            {item.name}
          </Link>
          <span className="text-14 text-text-secondary">Edição: {item.editionLabel}</span>
          <span className="mt-4 text-16 leading-4 font-bold text-text-accent">{formatEth(item.lineTotalEth)}</span>
        </div>
        <p className="hidden text-16 leading-4 font-bold text-text-secondary md:block">
          {formatEth(item.unitPriceEth)}
          {item.status === "price_changed" && (
            <s className="ml-2 text-12 font-normal text-secondary">
              <span className="sr-only">antes </span>
              {formatEth(item.addedUnitPriceEth)}
            </s>
          )}
          <span className="block text-12 font-normal text-secondary">Edição {item.editionLabel}</span>
        </p>
        <div className="flex flex-col items-end gap-3 md:items-start">
          <QuantityStepper
            size="sm"
            label={`Quantidade de ${item.name}, edição ${item.editionLabel}`}
            value={draft}
            max={Math.max(1, max)}
            onChange={setDraft}
            disabled={item.status === "sold_out" || remove.isPending}
          />
          <button
            type="button"
            className="grid size-6 place-items-center md:hidden"
            aria-label={`Remover ${item.name} do carrinho`}
            onClick={removeItem}
            disabled={remove.isPending}
          >
            <img src={deleteIcon} alt="" width={18} height={20} />
          </button>
        </div>
        <p className="hidden text-16 leading-4 font-bold text-text-accent md:block" aria-live="polite">
          {busy ? <span className="text-text-secondary">…</span> : formatEth(item.lineTotalEth)}
        </p>
        <button
          type="button"
          className="hidden size-6 place-items-center md:grid"
          aria-label={`Remover ${item.name} do carrinho`}
          onClick={removeItem}
          disabled={remove.isPending}
        >
          <img src={deleteIcon} alt="" width={18} height={20} />
        </button>
      </div>
      {warning && <CartItemWarning id={statusId} item={item} warning={warning} onRemove={removeItem} />}
    </li>
  );
}

type Warning = { text: string; action?: { label: string; quantity: number } };

function itemWarning(item: CartItem): Warning | null {
  switch (item.status) {
    case "price_changed":
      return {
        text: `O preço mudou de ${formatEth(item.addedUnitPriceEth)} para ${formatEth(item.unitPriceEth)}.`,
        action: { label: "Aceitar novo preço", quantity: item.quantity },
      };
    case "quantity_exceeds":
      return {
        text: `Só restam ${item.maxPerOrder} por pedido nesta edição.`,
        action: { label: `Ajustar para ${item.maxPerOrder}`, quantity: item.maxPerOrder },
      };
    case "sold_out":
      return { text: "Esta edição esgotou." };
    default:
      return null;
  }
}

function CartItemWarning({ id, item, warning, onRemove }: { id: string; item: CartItem; warning: Warning; onRemove: () => void }) {
  const update = useUpdateCartItem();
  return (
    <div id={id} role="status" className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2 text-13 text-coral">
      <span>{warning.text}</span>
      {warning.action ? (
        <Button
          size="none"
          variant="link"
          className="text-13"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { itemId: item.id, quantity: warning.action!.quantity },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        >
          {warning.action.label}
        </Button>
      ) : (
        <Button size="none" variant="link" className="text-13" onClick={onRemove}>
          Remover do carrinho
        </Button>
      )}
    </div>
  );
}

function CartSummary({ cart, blocked, onCheckout }: { cart: Cart; blocked: boolean; onCheckout: () => void }) {
  return (
    <aside
      aria-labelledby="summary-title"
      className="flex flex-col gap-6 max-md:-mx-4 max-md:rounded-t-[31px] max-md:bg-surface-card max-md:px-6 max-md:pt-6 max-md:pb-8 lg:w-[332px] lg:shrink-0"
    >
      <h2 id="summary-title" className="hidden border-b-[0.3px] border-foreground/40 pb-3 text-18 leading-4 font-bold md:block">
        Resumo da carteira
      </h2>
      <CouponForm cart={cart} />
      <TotalsList totals={cart.totals} />
      <div className="flex flex-col items-center gap-3">
        {blocked && (
          <p role="status" className="text-center text-13 text-coral">
            Revise os itens destacados antes de finalizar.
          </p>
        )}
        <Button className="h-10 w-full rounded-[3px] text-15 max-md:h-[60px] max-md:rounded-[10px]" disabled={blocked} onClick={onCheckout}>
          Conectar e finalizar
        </Button>
        <Link to="/" hash="catalogo" className="text-15 text-text-accent hover:underline">
          Continuar explorando
        </Link>
      </div>
    </aside>
  );
}

/** Totais exatamente como a API calculou (strings decimais). */
export function TotalsList({ totals, compact }: { totals: Cart["totals"]; compact?: boolean }) {
  const discount = totals.discountEth === "0" ? "(-) 0 ETH" : `(-) ${formatEth(totals.discountEth)}`;
  return (
    <dl className={cn("flex flex-col gap-3 text-15", compact && "gap-2")} aria-live="polite">
      <div className="flex items-center justify-between">
        <dt>Subtotal</dt>
        <dd className="text-18 leading-4">{formatEth(totals.subtotalEth)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Desconto do lançamento</dt>
        <dd>{discount}</dd>
      </div>
      {/* dt/dd precisam ser filhos diretos do grupo: a nota "Taxa estimada" fica dentro do dd. */}
      <div className="flex items-start justify-between">
        <dt>Taxa de rede</dt>
        <dd className="flex flex-col items-end gap-1">
          {/* Mesma altura de linha do dt (15px × 1.5): valor alinhado ao rótulo como nas outras linhas. */}
          <span className="text-18 leading-[22.5px]">{formatEth(totals.networkFeeEth)}</span>
          <span className="text-12 leading-4 text-text-accent">Taxa estimada</span>
        </dd>
      </div>
      <div className="flex items-center justify-between border-t-[0.3px] border-foreground/30 pt-3 font-bold">
        <dt className="text-16">Total</dt>
        <dd className="text-18 leading-4 text-text-accent">{formatEth(totals.totalEth)}</dd>
      </div>
    </dl>
  );
}

export function CouponForm({ cart }: { cart: Cart }) {
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  // Não é um <form>: o cupom também aparece dentro do formulário do pagamento.
  function submit(event?: FormEvent | KeyboardEvent) {
    event?.preventDefault();
    if (!code.trim()) {
      setError("Digite o código promocional");
      return;
    }
    apply.mutate(code.trim(), {
      onSuccess: (next) => {
        setError(null);
        setCode("");
        toast.success(`Cupom ${next.coupon?.code} aplicado.`);
      },
      onError: (err) => setError(isApiError(err) ? (err.fieldErrors.code ?? err.message) : errorMessage(err)),
    });
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[3px] border border-primary px-3 py-2 text-14">
        <span>
          Cupom <strong className="text-text-accent">{cart.coupon.code}</strong> · {cart.coupon.percentOff}% de desconto
        </span>
        <Button
          size="none"
          variant="link"
          className="text-13"
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) })}
        >
          Remover
        </Button>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={`${inputId}-label`} className="flex flex-col gap-2">
      <label id={`${inputId}-label`} htmlFor={inputId} className="text-14 leading-4 font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className={cn("flex h-10 overflow-hidden rounded-[3px] border border-primary max-md:h-[50px] max-md:rounded-[10px]", error && "border-error")}>
        <input
          id={inputId}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => event.key === "Enter" && submit(event)}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          maxLength={32}
          className="min-w-0 flex-1 bg-transparent px-2 text-12 placeholder:text-secondary focus:outline-none max-md:px-4 max-md:text-14"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={apply.isPending}
          className="w-[102px] shrink-0 bg-primary text-15 font-bold text-ink disabled:opacity-60 max-md:w-[97px]"
        >
          {apply.isPending ? "…" : "Aplicar"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-12 text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Colecionadores também viram": em alta, sem o que já está no carrinho. */
function AlsoViewed({ cart }: { cart: Cart | undefined }) {
  const trending = useQuery(nftListQueryOptions({ tab: "trending", pageSize: 12 }));
  const favorites = useFavorites();
  const favorite = useToggleFavorite();
  const ids = new Set(favorites.data?.nftIds ?? []);
  const inCart = new Set(cart?.items.map((item) => item.nftId));
  const items: NftSummary[] = (trending.data?.items ?? []).filter((nft) => !inCart.has(nft.id)).slice(0, 5);
  if (trending.isError || (trending.data && items.length === 0)) return null;

  return (
    <section aria-labelledby="also-viewed-title" className="hidden flex-col gap-8 md:flex">
      <h2 id="also-viewed-title" className="border-b-[0.3px] border-foreground/40 pb-3 text-17 leading-4 font-bold text-text-accent">
        Colecionadores também viram
      </h2>
      <div className="grid grid-cols-3 gap-6 lg:grid-cols-5">
        {trending.isPending
          ? Array.from({ length: 5 }, (_, index) => <NftCardSkeleton key={index} size="compact" />)
          : items.map((nft) => (
              <NftCard
                key={nft.id}
                nft={nft}
                size="compact"
                isFavorite={ids.has(nft.id)}
                onToggleFavorite={(item) => favorite.toggle(item.id, item.name, !ids.has(item.id))}
              />
            ))}
      </div>
    </section>
  );
}

function CartSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8 lg:flex-row lg:justify-between">
      <p role="status" className="sr-only">
        Carregando carrinho…
      </p>
      <div className="flex flex-1 flex-col gap-3 lg:max-w-[782px]">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[100px] w-full md:h-[70px] md:rounded-none" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:w-[332px]">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
