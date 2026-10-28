import { CatalogSection, MobileCatalogBar, type CatalogPatch } from "./catalog-section";
import { Blog, HomeHero, Promos } from "./home-sections";
import type { CatalogSearch } from "./search";

interface HomePageProps {
  search: CatalogSearch;
  onChange: (patch: CatalogPatch) => void;
  interactive?: boolean;
}

/** Início: hero, catálogo (estado na URL), promoções e blog. Também é o fundo dos modais de conta. */
export function HomePage({ search, onChange, interactive = true }: HomePageProps) {
  return (
    <div className="flex flex-col gap-4 md:gap-24">
      <div className="flex flex-col gap-4 md:gap-8">
        <MobileCatalogBar search={search} onChange={onChange} />
        <HomeHero />
      </div>
      <CatalogSection search={search} onChange={onChange} interactive={interactive} />
      <Promos />
      <Blog />
    </div>
  );
}
