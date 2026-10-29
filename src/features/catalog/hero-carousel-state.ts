import { useEffect, useRef, useState, type DragEvent, type FocusEvent, type MouseEvent, type PointerEvent } from "react";

/** Slides do hero: uma arte por ponto do Figma, cada uma levando ao detalhe do NFT. */
export const HERO_SLIDES = [
  { id: "emerald-ape-042", name: "Emerald Ape #042", art: "emerald", alt: "Emerald Ape #042, macaco de óculos e jaqueta verde" },
  { id: "ivory-baron-088", name: "Ivory Baron #088", art: "ivory", alt: "Ivory Baron #088, macaco de terno e gola alta" },
  { id: "golden-beat-207", name: "Golden Beat #207", art: "golden", alt: "Golden Beat #207, macaco dourado de fones" },
] as const;

export type HeroSlide = (typeof HERO_SLIDES)[number];

const AUTOPLAY_MS = 6_000;
/** Movimento mínimo para virar arraste: abaixo disso é um clique normal (EXPLORAR, pontos, arte). */
const DRAG_START_PX = 6;
/** Distância para trocar de slide ao soltar. */
const DRAG_SWITCH_PX = 60;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Estado do carrossel: troca sozinha a cada 6 s e para enquanto o ponteiro ou o foco estão nele
 * (ou durante o arraste). Com prefers-reduced-motion não troca sozinha.
 * Clicar e segurar em qualquer ponto do hero (mouse, caneta ou dedo) arrasta a arte; ao soltar
 * depois de 60px vai para o slide seguinte ou anterior.
 */
export function useHeroCarousel(count: number) {
  const [index, setIndex] = useState(0);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const start = useRef<{ x: number; pointerId: number } | null>(null);
  const dragged = useRef(false);
  const playing = !reducedMotion && !hovering && !focused && offset === null;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    // index nas dependências: depois de uma troca manual, o próximo avanço espera 6 s inteiros.
    return () => window.clearInterval(timer);
  }, [playing, count, index]);

  const go = (next: number) => setIndex(((next % count) + count) % count);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, pointerId: event.pointerId };
    dragged.current = false;
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.current.x;
    if (!dragged.current) {
      if (Math.abs(delta) < DRAG_START_PX) return;
      // Captura só quando virou arraste: um clique simples continua chegando ao link ou botão.
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setOffset(delta);
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.current.x;
    start.current = null;
    if (!dragged.current) return;
    if (Math.abs(delta) >= DRAG_SWITCH_PX) go(index + (delta < 0 ? 1 : -1));
    setOffset(null);
  }

  // Depois de um arraste, o clique que o navegador dispara ao soltar não deve abrir nada.
  function onClickCapture(event: MouseEvent) {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }

  return {
    index,
    go,
    playing,
    /** Deslocamento do arraste em px (null fora do arraste). */
    offset,
    /** Props do contêiner: arraste, e pausa no hover (mouse) e com o foco dentro do carrossel. */
    rootProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
      // Sem isso, segurar sobre um link ou imagem inicia o arrastar-e-soltar nativo e cancela o arraste.
      onDragStart: (event: DragEvent) => event.preventDefault(),
      onPointerEnter: (event: PointerEvent) => event.pointerType === "mouse" && setHovering(true),
      onPointerLeave: (event: PointerEvent) => event.pointerType === "mouse" && setHovering(false),
      onFocus: () => setFocused(true),
      onBlur: (event: FocusEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
    },
  };
}
