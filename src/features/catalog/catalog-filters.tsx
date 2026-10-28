import Decimal from "decimal.js";
import { useState } from "react";
import { categorySchema, networkSchema, type Category, type Network, type NftListResponse } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { CATEGORY_LABELS, formatEthRange, NETWORK_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CatalogSearch } from "./search";

interface CatalogFiltersProps {
  search: CatalogSearch;
  facets: NftListResponse["facets"] | undefined;
  onChange: (patch: Partial<Pick<CatalogSearch, "categories" | "networks" | "minPrice" | "maxPrice">>) => void;
  className?: string;
}

function toggle<T>(list: readonly T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function CheckRow({
  checked,
  label,
  count,
  onToggle,
  bold,
}: {
  checked: boolean;
  label: string;
  count: number | undefined;
  onToggle: () => void;
  bold?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-center justify-between rounded-[4px] text-15 leading-10 has-focus-visible:outline-2 has-focus-visible:outline-ring",
        checked ? "text-text-accent" : "text-text-secondary hover:text-foreground",
      )}
    >
      {/* Checkbox nativo invisível cobrindo a linha: clique, teclado e leitor de tela reais. */}
      <input type="checkbox" className="absolute inset-0 cursor-pointer opacity-0" checked={checked} onChange={onToggle} />
      <span className="flex items-center gap-2">
        {/* Marcador visível só quando ativo: o estado não depende apenas de cor. */}
        <span aria-hidden="true" className={cn("size-1.5 rounded-full bg-primary", !checked && "invisible")} />
        {label}
      </span>
      <span className={cn(bold && "font-bold")} aria-label={count === undefined ? undefined : `${count} itens`}>
        {count === undefined ? <Skeleton className="h-3 w-6" /> : `(${count})`}
      </span>
    </label>
  );
}

/** Painel de filtros do Figma (310px no desktop; conteúdo do sheet no mobile). */
export function CatalogFilters({ search, facets, onChange, className }: CatalogFiltersProps) {
  return (
    <div className={cn("flex flex-col gap-10", className)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-18 leading-4 font-bold">Coleções</legend>
        <div className="flex flex-col px-3">
          {categorySchema.options.map((category: Category) => (
            <CheckRow
              key={category}
              bold
              label={CATEGORY_LABELS[category]}
              count={facets?.categories[category]}
              checked={search.categories.includes(category)}
              onToggle={() => onChange({ categories: toggle(search.categories, category) })}
            />
          ))}
        </div>
      </fieldset>

      <PriceFilter
        // Remonta ao mudar a URL (voltar/avançar) para o slider refletir o estado atual.
        key={`${search.minPrice}-${search.maxPrice}-${facets?.priceRange.min}-${facets?.priceRange.max}`}
        search={search}
        range={facets?.priceRange}
        onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-18 leading-4 font-bold">Rede</legend>
        <div className="flex flex-col pl-3">
          {networkSchema.options.map((network: Network) => (
            <CheckRow
              key={network}
              label={NETWORK_LABELS[network]}
              count={facets?.networks[network]}
              checked={search.networks.includes(network)}
              onToggle={() => onChange({ networks: toggle(search.networks, network) })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function PriceFilter({
  search,
  range,
  onApply,
}: {
  search: CatalogSearch;
  range: NftListResponse["facets"]["priceRange"] | undefined;
  onApply: (min: string | undefined, max: string | undefined) => void;
}) {
  const bounds = range ? [Number(range.min), Number(range.max)] : [0, 0];
  const [value, setValue] = useState<number[]>([
    search.minPrice ? Number(search.minPrice) : bounds[0],
    search.maxPrice ? Number(search.maxPrice) : bounds[1],
  ]);
  const toEth = (n: number) => new Decimal(n).toDecimalPlaces(2).toFixed();
  const isFullRange = value[0] <= bounds[0] && value[1] >= bounds[1];

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-18 leading-4 font-bold">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        {range ? (
          <Slider
            min={bounds[0]}
            max={bounds[1]}
            step={0.01}
            minStepsBetweenThumbs={1}
            value={value}
            onValueChange={setValue}
            thumbLabels={["Preço mínimo", "Preço máximo"]}
          />
        ) : (
          <Skeleton className="h-5 w-full" />
        )}
        <p className="text-15" aria-live="polite">
          Preço: {range ? formatEthRange(toEth(value[0]), toEth(value[1])) : "…"}
        </p>
        <div className="flex gap-2">
          <Button
            size="none"
            className="px-3 py-2 text-16 leading-5"
            disabled={!range}
            onClick={() => (isFullRange ? onApply(undefined, undefined) : onApply(toEth(value[0]), toEth(value[1])))}
          >
            Aplicar
          </Button>
          {(search.minPrice || search.maxPrice) && (
            <Button size="none" variant="link" className="text-14" onClick={() => onApply(undefined, undefined)}>
              Limpar
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  );
}
