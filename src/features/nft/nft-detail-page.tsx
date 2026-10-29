import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useId } from "react";
import type { Edition, NftDetail } from "@/api/contracts";
import heartIcon from "@/assets/icons/heart.svg";
import arrowLeft from "@/assets/icons/m-arrow-left.svg";
import mHeart from "@/assets/icons/m-heart.svg";
import mShop from "@/assets/icons/m-shop-detail.svg";
import shareLinkedin from "@/assets/icons/share-linkedin.svg";
import shareMail from "@/assets/icons/share-mail.svg";
import shareTwitter from "@/assets/icons/share-twitter.svg";
import starEmpty from "@/assets/icons/star-empty.svg";
import star from "@/assets/icons/star.svg";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NftCard, NftCardSkeleton } from "@/features/catalog/nft-card";
import { nftDetailQueryOptions, nftRelatedQueryOptions } from "@/features/catalog/queries";
import { formatEth, NETWORK_LABELS, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFavorites, useToggleFavorite } from "./favorites";
import { GalleryImage, NftGallery } from "./gallery";
import { usePurchase } from "./purchase";

export function NftDetailPage({ id }: { id: string }) {
  // O loader já garantiu o dado; a query mantém o detalhe atualizado (refetch e, no Bloco 4, eventos).
  const { data: nft } = useQuery(nftDetailQueryOptions(id));
  if (!nft) return <NftDetailSkeleton />;
  return <NftDetailView key={nft.id} nft={nft} />;
}

function NftDetailView({ nft }: { nft: NftDetail }) {
  const purchase = usePurchase(nft);
  const favorites = useFavorites();
  const favorite = useToggleFavorite();
  const isFavorite = favorites.data?.nftIds.includes(nft.id) ?? false;
  const toggleFavorite = () => favorite.toggle(nft.id, nft.name, !isFavorite);
  const unavailableReason = !nft.available
    ? "Todas as edições deste NFT estão esgotadas."
    : !purchase.canBuy
      ? `A edição ${purchase.edition.label} está esgotada. Escolha outra edição.`
      : null;

  return (
    <article className="flex flex-col gap-12 pb-[180px] md:gap-24 md:pb-0">
      {/* ---------- Desktop / tablet ---------- */}
      <div className="hidden flex-col gap-3 md:flex">
        <nav aria-label="Trilha de navegação" className="text-15 leading-4 font-bold">
          <Link to="/" className="hover:text-text-accent">
            Início
          </Link>{" "}
          /{" "}
          <Link to="/" hash="catalogo" className="hover:text-text-accent">
            Mercado
          </Link>
        </nav>
        <div className="flex flex-col gap-8 lg:flex-row">
          <NftGallery nft={nft} />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
            <div className="flex flex-col gap-3 border-b-[0.3px] border-foreground/40 pb-3">
              <h1 className="text-28 font-bold">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-22 leading-4 font-bold text-text-accent" aria-live="polite">
                  {formatEth(purchase.edition.priceEth)}
                </p>
                <Rating rating={nft.rating} count={nft.reviewsCount} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-15 leading-4 font-bold">Sobre este NFT:</h2>
              <p className="text-14 leading-6 text-text-secondary">{nft.summary}</p>
            </div>
            <EditionPicker editions={nft.editions} selectedId={purchase.edition.id} onSelect={purchase.selectEdition} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <QuantityStepper
                label={`Quantidade da edição ${purchase.edition.label}`}
                value={purchase.quantity}
                max={purchase.edition.maxPerOrder}
                onChange={purchase.setQuantity}
                disabled={!purchase.canBuy}
              />
              <div className="flex gap-2">
                <Button
                  className="w-[130px] text-14 leading-5"
                  disabled={!purchase.canBuy || purchase.isAdding}
                  onClick={() => void purchase.add({ goToCart: true })}
                >
                  {purchase.isAdding ? "Adicionando…" : "COMPRAR"}
                </Button>
                <Button
                  variant="outline"
                  className={cn("w-[130px] gap-2 text-14 font-medium", isFavorite && "bg-primary/15")}
                  aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
                  aria-pressed={isFavorite}
                  onClick={toggleFavorite}
                >
                  <img src={heartIcon} alt="" width={20} height={20} />
                  {isFavorite ? "Favoritado" : "Favoritar"}
                </Button>
              </div>
            </div>
            <PurchaseHint edition={purchase.edition} reason={unavailableReason} />
            <TokenInfo nft={nft} />
            <ShareLinks nft={nft} />
          </div>
        </div>
      </div>

      {/* ---------- Mobile ---------- */}
      <div className="-mx-4 -mt-6 flex flex-col md:hidden">
        <div className="relative bg-linear-[138deg] from-surface-card from-12% to-surface-raised px-7 pt-6 pb-[130px]">
          <div className="mb-2 flex items-center justify-between">
            <BackButton />
            <button
              type="button"
              aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
              aria-pressed={isFavorite}
              onClick={toggleFavorite}
              className={cn(
                "grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised",
                isFavorite && "border-primary bg-primary/25",
              )}
            >
              <img src={mHeart} alt="" width={16} height={14} />
            </button>
          </div>
          <GalleryImage image={nft.images[0]} sizes="100vw" priority className="h-[356px] w-full rounded-[24px]" />
        </div>
        <div className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pt-8 pb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-20 leading-tight font-bold">{nft.name}</h1>
            <p className="flex shrink-0 items-center gap-1.5 rounded-[32px] border border-primary px-2 py-1 text-14">
              <img src={star} alt="" width={13} height={12} />
              <span className="font-medium">{nft.rating.toFixed(1)}</span>
              <span className="text-text-secondary">
                ({nft.reviewsCount})<span className="sr-only"> avaliações</span>
              </span>
            </p>
          </div>
          <p className="text-14 leading-6 text-text-secondary">{nft.summary}</p>
          <EditionPicker editions={nft.editions} selectedId={purchase.edition.id} onSelect={purchase.selectEdition} compact />
          <TokenInfo nft={nft} />
          <PurchaseHint edition={purchase.edition} reason={unavailableReason} />
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-5 rounded-t-[40px] bg-surface-card px-6 pt-5 pb-9 shadow-[0_0_10px_rgba(10,6,4,0.45)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-15 leading-4 font-medium text-text-secondary" aria-hidden="true">
                Qtd.
              </span>
              <QuantityStepper
                size="sm"
                label={`Quantidade da edição ${purchase.edition.label}`}
                value={purchase.quantity}
                max={purchase.edition.maxPerOrder}
                onChange={purchase.setQuantity}
                disabled={!purchase.canBuy}
              />
            </div>
            <p className="text-20 leading-4 font-bold text-text-accent">
              <span className="sr-only">Total: </span>
              {formatEth(purchase.totalEth)}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              size="pill"
              className="flex-1 bg-linear-[100deg] from-primary from-4% to-primary/80"
              disabled={!purchase.canBuy || purchase.isAdding}
              onClick={() => void purchase.add({ goToCart: true })}
            >
              {purchase.isAdding ? "Adicionando…" : "Comprar NFT"}
            </Button>
            <Button
              variant="subtle"
              size="none"
              className="size-[60px] rounded-[40px]"
              aria-label={`Adicionar ${nft.name} ao carrinho e continuar navegando`}
              disabled={!purchase.canBuy || purchase.isAdding}
              onClick={() => void purchase.add({ goToCart: false })}
            >
              <img src={mShop} alt="" width={20} height={20} />
            </Button>
          </div>
        </div>
      </div>

      <DetailsTabs nft={nft} />
      <RelatedNfts id={nft.id} />
    </article>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: "/" }))}
      className="grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised"
    >
      <img src={arrowLeft} alt="" width={13} height={7} className="rotate-90" />
    </button>
  );
}

function Rating({ rating, count }: { rating: number; count: number }) {
  const filled = Math.round(rating);
  return (
    <p className="flex items-center gap-1 text-15">
      <span className="sr-only">Nota {rating.toFixed(1)} de 5.</span>
      {Array.from({ length: 5 }, (_, index) => (
        <img key={index} src={index < filled ? star : starEmpty} alt="" width={13} height={12} className="mx-px" />
      ))}
      <span className="ml-1">{count} avaliações de colecionadores</span>
    </p>
  );
}

/** Edições como radio group: setas do teclado alternam; esgotadas ficam desabilitadas e dizem isso. */
function EditionPicker({
  editions,
  selectedId,
  onSelect,
  compact,
}: {
  editions: Edition[];
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2 md:gap-3">
      <legend className="mb-2 text-15 leading-4 font-bold md:mb-3">Edição:</legend>
      <div className={cn("flex flex-wrap", compact ? "gap-3" : "gap-1.5")}>
        {editions.map((edition) => {
          const soldOut = edition.available === 0;
          const selected = edition.id === selectedId;
          return (
            <label
              key={edition.id}
              title={soldOut ? "Esgotada" : `${edition.available === 999 ? "Edição aberta" : `${edition.available} disponíveis`}`}
              className={cn(
                "relative flex h-7 cursor-pointer items-center rounded-full border px-2 text-14 leading-4 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                selected ? "border-primary font-medium text-text-accent" : "border-border text-text-secondary",
                soldOut && "cursor-not-allowed line-through opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                value={edition.id}
                checked={selected}
                disabled={soldOut}
                onChange={() => onSelect(edition.id)}
              />
              {edition.label}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PurchaseHint({ edition, reason }: { edition: Edition; reason: string | null }) {
  return (
    <p role="status" className={cn("text-13", reason ? "text-coral" : "text-text-secondary")}>
      {reason ??
        (edition.supply === null
          ? `Edição aberta · até ${edition.maxPerOrder} por pedido.`
          : `${edition.available} de ${edition.supply} disponíveis · até ${edition.maxPerOrder} por pedido.`)}
    </p>
  );
}

function TokenInfo({ nft }: { nft: NftDetail }) {
  return (
    <dl className="flex flex-col gap-3 text-15 text-secondary">
      <div className="flex gap-1">
        <dt>ID do token:</dt>
        <dd>{nft.tokenId}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Coleção:</dt>
        <dd>{nft.collection}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Atributos:</dt>
        <dd>{nft.attributes.join(", ")}</dd>
      </div>
    </dl>
  );
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window === "undefined" ? "" : window.location.href;
  const text = `${nft.name} na Kurio`;
  const links = [
    { icon: shareLinkedin, label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, w: 15, h: 14 },
    { icon: shareMail, label: "e-mail", href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, w: 18, h: 18 },
    { icon: shareTwitter, label: "X (Twitter)", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, w: 16, h: 12 },
  ];
  return (
    <div className="flex items-center gap-2">
      <p className="text-15 leading-4 font-bold">Compartilhar este NFT:</p>
      <ul className="flex items-center gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target={link.href.startsWith("mailto") ? undefined : "_blank"}
              rel="noreferrer"
              aria-label={`Compartilhar por ${link.label}`}
              className="grid size-7 place-items-center rounded-[4px] hover:bg-surface-raised"
            >
              <img src={link.icon} alt="" width={link.w} height={link.h} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs defaultValue="details" className="flex flex-col gap-3">
      <TabsList aria-label="Informações do NFT">
        <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
        <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="flex flex-col gap-3 text-14 leading-6 text-text-secondary">
        {nft.description.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <h2 className="font-bold text-foreground">Rede:</h2>
        <p>Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
        <h2 className="font-bold text-foreground">Contrato:</h2>
        <p>
          <span title={nft.contractAddress}>{shortAddress(nft.contractAddress)}</span> • Contrato inteligente ERC-721 verificado.
        </p>
        <h2 className="font-bold text-foreground">Direitos autorais:</h2>
        <p>
          Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados
          compatíveis.
        </p>
      </TabsContent>
      <TabsContent value="reviews" className="flex flex-col gap-3 text-14 leading-6 text-text-secondary">
        <Rating rating={nft.rating} count={nft.reviewsCount} />
        <p>As avaliações escritas de colecionadores não fazem parte desta demonstração; apenas a nota média é exibida.</p>
      </TabsContent>
    </Tabs>
  );
}

function RelatedNfts({ id }: { id: string }) {
  const related = useQuery(nftRelatedQueryOptions(id));
  const favorites = useFavorites();
  const favorite = useToggleFavorite();
  const ids = new Set(favorites.data?.nftIds ?? []);
  if (related.isError || (related.data && related.data.items.length === 0)) return null;

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <h2 id="related-title" className="border-b-[0.3px] border-foreground/40 pb-3 text-17 leading-4 font-bold text-text-accent">
        Mais desta coleção
      </h2>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-5 lg:gap-6">
        {related.isPending
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="w-[44vw] shrink-0 snap-start md:w-auto">
                <NftCardSkeleton size="compact" />
              </div>
            ))
          : related.data.items.map((item) => (
              <div key={item.id} className="w-[44vw] shrink-0 snap-start md:w-auto">
                <NftCard
                  nft={item}
                  size="compact"
                  isFavorite={ids.has(item.id)}
                  onToggleFavorite={(nft) => favorite.toggle(nft.id, nft.name, !ids.has(nft.id))}
                />
              </div>
            ))}
      </div>
    </section>
  );
}

/** Mesmo esqueleto da tela: usado no carregamento da rota (pendingComponent). */
export function NftDetailSkeleton() {
  return (
    // min-h-dvh: a tela carregada é mais alta que a viewport; sem isso o rodapé aparece e depois é empurrado (CLS).
    <div aria-busy="true" className="flex min-h-dvh flex-col gap-8">
      <p role="status" className="sr-only">
        Carregando NFT…
      </p>
      <Skeleton className="hidden h-4 w-40 md:block" />
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex gap-7">
          <div className="hidden w-[100px] flex-col gap-4 md:flex">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="size-[100px] rounded-[8px]" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full rounded-[24px] md:size-[min(444px,42vw)] md:rounded-[6px]" />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-2/3" />
        </div>
      </div>
    </div>
  );
}
