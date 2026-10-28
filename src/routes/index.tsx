import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { HomePage } from "@/features/catalog/home-page";
import type { CatalogPatch } from "@/features/catalog/catalog-section";
import {
  CATALOG_DEFAULTS,
  catalogSearchSchema,
  toSearchInput,
  type CatalogSearchInput,
} from "@/features/catalog/search";

export const Route = createFileRoute("/")({
  // A URL guarda a forma serializada (listas "a,b"); valores inválidos caem no padrão.
  validateSearch: (raw: Record<string, unknown>): CatalogSearchInput => toSearchInput(catalogSearchSchema.parse(raw)),
  // Padrões não poluem a URL: "/" equivale a aba "all", ordenação "recent", página 1.
  search: { middlewares: [stripSearchParams(CATALOG_DEFAULTS)] },
  component: HomeRoute,
});

function HomeRoute() {
  const raw = Route.useSearch();
  const search = useMemo(() => catalogSearchSchema.parse(raw), [raw]);
  const navigate = useNavigate({ from: "/" });

  const onChange = useCallback(
    (patch: CatalogPatch) => {
      void navigate({
        search: (prev) => {
          const current = catalogSearchSchema.parse(prev);
          // Qualquer filtro novo reinicia a paginação; só a própria paginação a preserva.
          const next = { ...current, ...patch, page: patch.page ?? 1 };
          return toSearchInput(next);
        },
        // Digitação na busca substitui a entrada do histórico; filtros e páginas criam novas.
        replace: Object.keys(patch).length === 1 && "q" in patch,
        resetScroll: false,
      });
    },
    [navigate],
  );

  return <HomePage search={search} onChange={onChange} />;
}
