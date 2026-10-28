import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

const stringify = stringifySearchWith((value) => (typeof value === "string" ? value : JSON.stringify(value)));

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // O Query cuida do cache; o router não deve guardar dados de loader por conta própria.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Search params legíveis (?categories=musica,fotografia&page=2) em vez de JSON na URL.
    // Os tipos são restaurados pelos schemas zod de cada rota.
    parseSearch: parseSearchWith((value) => value),
    // Vírgula é válida em query string: mantida literal para listas legíveis.
    stringifySearch: (search) => stringify(search).replace(/%2C/gi, ","),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
