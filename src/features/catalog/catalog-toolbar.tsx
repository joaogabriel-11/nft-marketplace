import type { NftSort, NftTab } from "@/api/contracts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TAB_LABELS: Record<NftTab, string> = {
  all: "Todos os NFTs",
  new: "Novos lançamentos",
  trending: "Em alta",
};

const SORT_LABELS: Record<NftSort, string> = {
  recent: "Listados recentemente",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  name: "Nome (A–Z)",
};

/**
 * Abas filtram a listagem (não trocam painéis), por isso são botões com aria-pressed
 * em vez de role="tab": o resultado é a mesma grade com outros parâmetros.
 */
export function CatalogTabs({ tab, onChange, className }: { tab: NftTab; onChange: (tab: NftTab) => void; className?: string }) {
  return (
    <div role="group" aria-label="Tipo de listagem" className={cn("flex gap-4 md:gap-5", className)}>
      {(Object.keys(TAB_LABELS) as NftTab[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={tab === key}
          onClick={() => onChange(key)}
          className={cn(
            "relative pb-1.5 text-14 leading-4 whitespace-nowrap md:text-15",
            tab === key ? "font-bold text-text-accent md:font-medium" : "text-foreground hover:text-text-accent",
          )}
        >
          {TAB_LABELS[key]}
          {tab === key && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
        </button>
      ))}
    </div>
  );
}

export function CatalogSort({ sort, onChange }: { sort: NftSort; onChange: (sort: NftSort) => void }) {
  return (
    <div className="flex items-center gap-2 text-15">
      <span id="sort-label">Ordenar por:</span>
      <Select value={sort} onValueChange={(value) => onChange(value as NftSort)}>
        <SelectTrigger aria-labelledby="sort-label sort-value" className="pb-1">
          <span id="sort-value">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as NftSort[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
