import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { HERO_SLIDES, type HeroSlide } from "./hero-carousel-state";

/**
 * Trilho de slides lado a lado. Durante o arraste (controlado pelo hero, ver useHeroCarousel) a arte
 * acompanha o ponteiro. Só o slide atual fica acessível (os outros ficam inertes).
 */
export function HeroSlides({
  index,
  playing,
  offset,
  className,
  imageClassName,
  sizes,
  size,
  src,
  srcSet,
}: {
  index: number;
  playing: boolean;
  offset: number | null;
  className?: string;
  imageClassName?: string;
  sizes: string;
  size: number;
  src: (slide: HeroSlide) => string;
  srcSet?: (slide: HeroSlide) => string;
}) {
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden", className, imageClassName)}
      // Anuncia a troca só fora da reprodução automática (padrão APG para carrosséis).
      aria-live={playing ? "off" : "polite"}
    >
      <div
        className={cn("flex size-full", offset === null && "transition-transform duration-500 ease-out motion-reduce:transition-none")}
        style={{ transform: `translateX(calc(${-index * 100}% + ${offset ?? 0}px))` }}
      >
        {HERO_SLIDES.map((slide, position) => {
          const active = position === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} de ${HERO_SLIDES.length}: ${slide.name}`}
              aria-hidden={!active || undefined}
              inert={!active}
              className="size-full shrink-0"
            >
              <Link to="/nfts/$id" params={{ id: slide.id }} draggable={false} className="block size-full">
                <img
                  src={src(slide)}
                  srcSet={srcSet?.(slide)}
                  sizes={sizes}
                  alt={slide.alt}
                  width={size}
                  height={size}
                  // Só a primeira arte é a imagem principal da página (LCP). As outras ficam fora da tela,
                  // à direita no trilho, e só carregam quando o carrossel chega perto delas.
                  fetchPriority={position === 0 ? "high" : "low"}
                  loading={position === 0 ? "eager" : "lazy"}
                  draggable={false}
                  className={cn("size-full object-cover", imageClassName)}
                />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pontos do Figma como controles: o atual fica sólido. */
export function HeroControls({ index, go, small }: { index: number; go: (index: number) => void; small?: boolean }) {
  return (
    // Botões de 24px (área de toque); a margem negativa mantém na diagramação só a altura dos pontos do Figma.
    <div className={cn("-my-2 flex items-center", small ? "gap-1" : "gap-2")}>
      {HERO_SLIDES.map((slide, position) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => go(position)}
          aria-label={`Mostrar slide ${position + 1}: ${slide.name}`}
          aria-current={position === index || undefined}
          className="grid size-6 place-items-center rounded-full"
        >
          <span
            className={cn(
              "block rounded-full bg-primary transition-opacity motion-reduce:transition-none",
              small ? "size-[7px]" : "size-2",
              position === index ? "opacity-100" : "opacity-40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
