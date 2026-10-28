import { Link, useNavigate } from "@tanstack/react-router";
import type { NftSummary } from "@/api/contracts";
import cardCart from "@/assets/icons/card-cart.svg";
import cardHeart from "@/assets/icons/card-heart.svg";
import cardView from "@/assets/icons/card-view.svg";
import mobileFav from "@/assets/icons/m-fav-card.svg";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEth, nftImageSrcSet } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NftCardProps {
  nft: NftSummary;
  isFavorite: boolean;
  onToggleFavorite: (nft: NftSummary) => void;
  /** Carregamento prioritário (primeira dobra) para o LCP. */
  priority?: boolean;
  size?: "default" | "compact";
}

const ACTION = "grid size-[35px] place-items-center rounded-[4px] border border-border bg-surface-raised hover:border-primary";

/**
 * Card do catálogo. O nome é o link (área clicável estendida ao card todo);
 * as ações ficam acima do link para não aninhar elementos interativos.
 * Desktop: ações no hover/foco (Figma). Mobile: coração fixo no canto (Figma mobile).
 */
export function NftCard({ nft, isFavorite, onToggleFavorite, priority = false, size = "default" }: NftCardProps) {
  const navigate = useNavigate();
  const goToDetail = () => navigate({ to: "/nfts/$id", params: { id: nft.id } });
  const favoriteLabel = isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`;

  return (
    <article className="group relative flex flex-col gap-2 md:gap-3">
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-[20px] bg-linear-[140deg] from-surface-card from-12% to-surface-raised p-1 md:rounded-none md:bg-surface-card md:bg-none",
          size === "default" ? "aspect-[175/200] md:aspect-[258/300]" : "aspect-[219/255]",
        )}
      >
        <img
          src={nft.imageUrl}
          srcSet={nftImageSrcSet(nft.imageUrl)}
          sizes="(min-width: 768px) 258px, 45vw"
          alt=""
          width={512}
          height={512}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className={cn("aspect-square w-[96%] rounded-[16px] object-cover md:rounded-[15px]", !nft.available && "opacity-60")}
        />
        {nft.isRare && (
          <span className="absolute top-4 left-0 bg-primary px-2 py-2 text-13 leading-4 font-medium text-ink md:top-[14px] md:px-[15px] md:py-[6.5px] md:text-16">
            RARO
          </span>
        )}
        {!nft.available && (
          <span className="absolute right-3 bottom-3 rounded-[4px] bg-ink/85 px-2 py-1 text-12 font-bold text-text-secondary">
            Esgotado
          </span>
        )}
        <div className="absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 gap-2.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <button type="button" className={ACTION} aria-label={`Escolher edição de ${nft.name} para o carrinho`} onClick={goToDetail}>
            <img src={cardCart} alt="" width={20} height={20} />
          </button>
          <button
            type="button"
            className={cn(ACTION, isFavorite && "border-primary bg-primary/25")}
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(nft)}
          >
            <img src={cardHeart} alt="" width={20} height={20} />
          </button>
          <button type="button" className={ACTION} aria-label={`Ver detalhes de ${nft.name}`} onClick={goToDetail}>
            <img src={cardView} alt="" width={20} height={20} />
          </button>
        </div>
        <button
          type="button"
          className={cn("absolute top-3 right-3 z-10 size-7 rounded-full md:hidden", isFavorite && "ring-2 ring-primary")}
          aria-label={favoriteLabel}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(nft)}
        >
          <img src={mobileFav} alt="" width={28} height={28} />
        </button>
      </div>
      <div className="flex flex-col gap-1 pl-2 md:gap-1.5 md:pl-0">
        <h3 className="text-15 leading-tight md:text-16 md:leading-4">
          <Link to="/nfts/$id" params={{ id: nft.id }} className="after:absolute after:inset-0 after:content-['']">
            {nft.name}
          </Link>
        </h3>
        <p className="flex items-center gap-3 text-16 leading-4 md:text-18">
          <span className="font-bold text-text-accent">{formatEth(nft.priceEth)}</span>
          {nft.compareAtPriceEth && (
            <s className="text-secondary">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.compareAtPriceEth)}
            </s>
          )}
        </p>
      </div>
    </article>
  );
}

/** Mesmas dimensões do card real: a grade não "pula" quando os dados chegam. */
export function NftCardSkeleton({ size = "default" }: { size?: "default" | "compact" }) {
  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <Skeleton className={cn("rounded-[20px] md:rounded-none", size === "default" ? "aspect-[175/200] md:aspect-[258/300]" : "aspect-[219/255]")} />
      <div className="flex flex-col gap-1.5 pl-2 md:pl-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
