import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { NftListResponse, NftSummary } from "@/api/contracts";
import filterIcon from "@/assets/icons/m-filter.svg";
import searchIcon from "@/assets/icons/m-search.svg";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFavorites, useToggleFavorite } from "@/features/nft/favorites";
import { errorMessage } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { CatalogFilters } from "./catalog-filters";
import { CatalogSort, CatalogTabs } from "./catalog-toolbar";
import { FeaturedBanner } from "./home-sections";
import { NftCard, NftCardSkeleton } from "./nft-card";
import { Pagination } from "./pagination";
import { nftListQueryOptions } from "./queries";
import { CATALOG_PAGE_SIZE, toListParams, type CatalogSearch } from "./search";

export type CatalogPatch = Partial<CatalogSearch>;

interface CatalogSectionProps {
  search: CatalogSearch;
  /** Atualiza a URL. Qualquer mudança que não seja de página volta para a página 1. */
  onChange: (patch: CatalogPatch) => void;
  /** false quando a home está ao fundo de um dialog (login/cadastro). */
  interactive?: boolean;
}

export function CatalogSection({ search, onChange, interactive = true }: CatalogSectionProps) {
  const params = useMemo(() => toListParams(search), [search]);
  const query = useQuery(nftListQueryOptions(params));
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favoriteIds = useMemo(() => new Set(favorites.data?.nftIds ?? []), [favorites.data]);
  const sectionRef = useRef<HTMLElement>(null);
  const statusId = useId();

  const { data } = query;
  const updating = query.isFetching && query.isPlaceholderData;
  const hasFilters = !!(search.q || search.categories.length || search.networks.length || search.minPrice || search.maxPrice);

  function changePage(page: number) {
    onChange({ page });
    sectionRef.current?.scrollIntoView({ block: "start" });
  }

  const onToggle = (nft: NftSummary) => toggleFavorite.toggle(nft.id, nft.name, !favoriteIds.has(nft.id));
  const clearFilters = () => onChange({ q: undefined, categories: [], networks: [], minPrice: undefined, maxPrice: undefined });

  const status = query.isPending
    ? "Carregando NFTs…"
    : updating
      ? "Atualizando resultados…"
      : data
        ? `${data.total} ${data.total === 1 ? "NFT encontrado" : "NFTs encontrados"}`
        : "";

  return (
    <section id="catalogo" ref={sectionRef} aria-labelledby="catalog-title" className="flex gap-12">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <aside className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex" aria-label="Filtros">
        <div className="bg-surface-card p-5">
          <CatalogFilters search={search} facets={data?.facets} onChange={onChange} />
        </div>
        <FeaturedBanner />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col items-end gap-10 md:gap-[88px]">
        <div className="flex w-full flex-col gap-6 md:gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CatalogTabs tab={search.tab} onChange={(tab) => onChange({ tab })} className="overflow-x-auto" />
            <div className="hidden items-center gap-4 md:flex">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="subtle" size="sm" className="lg:hidden">
                    Filtros
                  </Button>
                </SheetTrigger>
                <FiltersSheet search={search} data={data} onChange={onChange} />
              </Sheet>
              <CatalogSort sort={search.sort} onChange={(sort) => onChange({ sort })} />
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-3 text-14 text-text-secondary">
              {search.q && (
                <span>
                  Resultados para <strong className="text-foreground">“{search.q}”</strong>
                </span>
              )}
              <button type="button" className="text-text-accent underline-offset-4 hover:underline" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>
          )}

          <p id={statusId} role="status" aria-live="polite" className="sr-only">
            {status}
          </p>

          {query.isError && data && (
            <div role="alert" className="flex items-center justify-between gap-4 rounded-[6px] border border-error/60 bg-error/10 px-4 py-3 text-14">
              <span>Não foi possível atualizar a lista. {errorMessage(query.error, "")}</span>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {query.isPending ? (
            <CatalogGrid aria-busy>
              {Array.from({ length: CATALOG_PAGE_SIZE }, (_, index) => (
                <NftCardSkeleton key={index} />
              ))}
            </CatalogGrid>
          ) : query.isError && !data ? (
            <div role="alert" className="flex w-full flex-col items-center gap-4 rounded-[8px] bg-surface-card px-6 py-16 text-center">
              <p className="text-18 font-bold">Não conseguimos carregar o catálogo</p>
              <p className="text-14 text-text-secondary">{errorMessage(query.error)}</p>
              <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="flex w-full flex-col items-center gap-4 rounded-[8px] bg-surface-card px-6 py-16 text-center">
              <p className="text-18 font-bold">Nenhum NFT encontrado</p>
              <p className="max-w-md text-14 text-text-secondary">
                {data.total > 0
                  ? "Esta página não existe mais para os filtros atuais."
                  : "Tente outros termos ou remova alguns filtros para ver mais resultados."}
              </p>
              {data.total > 0 ? (
                <Button onClick={() => onChange({ page: 1 })}>Ir para a primeira página</Button>
              ) : (
                hasFilters && <Button onClick={clearFilters}>Limpar filtros</Button>
              )}
            </div>
          ) : (
            data && (
              <CatalogGrid aria-busy={updating} aria-describedby={statusId} className={cn(updating && "opacity-60 transition-opacity")}>
                {data.items.map((nft, index) => (
                  <NftCard
                    key={nft.id}
                    nft={nft}
                    priority={index < 3}
                    isFavorite={favoriteIds.has(nft.id)}
                    onToggleFavorite={interactive ? onToggle : () => undefined}
                  />
                ))}
              </CatalogGrid>
            )
          )}
        </div>
        {data && <Pagination page={search.page} totalPages={data.totalPages} onChange={changePage} />}
      </div>
    </section>
  );
}

function CatalogGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // Mobile: duas colunas desencontradas como no Figma (coluna direita 32px abaixo).
        "grid w-full grid-cols-2 gap-x-4 gap-y-6 pb-8 max-md:[&>*:nth-child(even)]:translate-y-8 md:grid-cols-2 md:gap-x-8 md:gap-y-[72px] md:pb-0 lg:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}

function FiltersSheet({
  search,
  data,
  onChange,
}: {
  search: CatalogSearch;
  data: NftListResponse | undefined;
  onChange: (patch: CatalogPatch) => void;
}) {
  return (
    <SheetContent side="right" className="overflow-y-auto p-6 pt-14">
      <SheetTitle className="mb-1 text-20 font-bold">Filtros</SheetTitle>
      <SheetDescription className="mb-6 text-13 text-text-secondary">
        {data ? `${data.total} resultados com os filtros atuais.` : "Carregando resultados…"}
      </SheetDescription>
      <CatalogFilters search={search} facets={data?.facets} onChange={onChange} />
    </SheetContent>
  );
}

/** Barra de busca + botão de filtros do Figma mobile (busca com debounce na URL). */
export function MobileCatalogBar({ search, onChange }: { search: CatalogSearch; onChange: (patch: CatalogPatch) => void }) {
  const [value, setValue] = useState(search.q ?? "");
  const params = useMemo(() => toListParams(search), [search]);
  const { data } = useQuery({ ...nftListQueryOptions(params), enabled: false });
  const inputId = useId();
  const activeFilters = search.categories.length + search.networks.length + (search.minPrice || search.maxPrice ? 1 : 0);

  // Voltar/avançar no histórico muda a URL: o campo acompanha.
  const [lastQ, setLastQ] = useState(search.q);
  if (search.q !== lastQ) {
    setLastQ(search.q);
    setValue(search.q ?? "");
  }

  useEffect(() => {
    const next = value.trim() || undefined;
    if (next === search.q) return;
    const timer = window.setTimeout(() => onChange({ q: next }), 350);
    return () => window.clearTimeout(timer);
  }, [value, search.q, onChange]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onChange({ q: value.trim() || undefined });
  }

  return (
    <div className="flex gap-2 md:hidden">
      <form role="search" onSubmit={submit} className="flex h-[45px] flex-1 items-center gap-2 rounded-[10px] bg-surface-card px-3">
        <img src={searchIcon} alt="" width={22} height={22} />
        <label htmlFor={inputId} className="sr-only">
          Explorar coleções
        </label>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Explorar coleções"
          maxLength={80}
          className="h-full min-w-0 flex-1 bg-transparent text-14 font-bold placeholder:text-secondary focus:outline-none"
        />
      </form>
      <Sheet>
        <SheetTrigger
          className="relative grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-linear-[137deg] from-primary/45 from-25% to-primary"
          aria-label={activeFilters ? `Filtros, ${activeFilters} ativos` : "Filtros"}
        >
          <img src={filterIcon} alt="" width={16} height={16} />
          {activeFilters > 0 && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-foreground text-10 font-bold text-ink">
              {activeFilters}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="overflow-y-auto px-6 pt-10 pb-8">
          <SheetTitle className="mb-1 text-20 font-bold">Filtros</SheetTitle>
          <SheetDescription className="mb-6 text-13 text-text-secondary">
            {data ? `${data.total} resultados com os filtros atuais.` : "Ajuste coleções, preço e rede."}
          </SheetDescription>
          <div className="mb-6 flex flex-col gap-4">
            <CatalogSort sort={search.sort} onChange={(sort) => onChange({ sort })} />
          </div>
          <CatalogFilters search={search} facets={data?.facets} onChange={onChange} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
