import { createRouter, stringifySearchWith } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { hashScrollBehavior } from "@/lib/hash-scroll";
import { routeTree } from "./routeTree.gen";

const stringify = stringifySearchWith((value) => (typeof value === "string" ? value : JSON.stringify(value)));

function parseSearchAsText(searchStr: string) {
  const search: Record<string, string> = {};
  new URLSearchParams(searchStr).forEach((value, key) => {
    search[key] = value;
  });
  return search;
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // O Query cuida do cache; o router não deve guardar dados de loader por conta própria.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Links com hash (Mercado → #catalogo) descem suavemente; sem animação com movimento reduzido.
    defaultHashScrollIntoView: { behavior: hashScrollBehavior(), block: "start" },
    // Search params legíveis (?categories=musica,fotografia&page=2) em vez de JSON na URL.
    // Os tipos são restaurados pelos schemas zod de cada rota.
    // Tudo chega como texto: o parser padrão converte "1.92" em número, e valores ETH (sempre
    // string decimal) ou buscas como "042" seriam descartados pela validação.
    parseSearch: parseSearchAsText,
    // Vírgula é válida em query string: mantida literal para listas legíveis.
    stringifySearch: (search) => stringify(search).replace(/%2C/gi, ","),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
