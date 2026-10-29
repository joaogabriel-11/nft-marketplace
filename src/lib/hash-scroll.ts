/** Rolagem até âncoras: suave, ou instantânea com prefers-reduced-motion. */
export function hashScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * Um link para o endereço atual com âncora (Mercado já em /#catalogo, depois de rolar para cima)
 * não rolava: o router via o mesmo endereço e restaurava a rolagem. Este listener cobre esse caso;
 * nas outras navegações quem rola é o router (defaultHashScrollIntoView em src/router.tsx).
 */
export function installSameHashScroll() {
  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.hash || anchor.target === "_blank") return;
    if (anchor.href !== window.location.href) return;
    const target = document.getElementById(decodeURIComponent(anchor.hash.slice(1)));
    if (!target) return;
    // Já estamos nesse endereço: não há navegação. Se o router tratasse o clique, a restauração de
    // rolagem dele interromperia a animação; por isso o clique para aqui.
    event.preventDefault();
    event.stopPropagation();
    target.scrollIntoView({ behavior: hashScrollBehavior(), block: "start" });
  }
  // Fase de captura no document: roda antes do Link do router (o React escuta no #root).
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
