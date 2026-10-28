import { Link } from "@tanstack/react-router";
import arrowRight from "@/assets/icons/arrow-right.svg";
import dots from "@/assets/icons/dots.svg";
import mobileArrow from "@/assets/icons/m-arrow-right.svg";
import heroMaskMobile from "@/assets/icons/m-hero-mask.svg";
import promoMask from "@/assets/icons/promo-mask.svg";
import { buttonVariants } from "@/components/ui/button";
import { notifyUnavailable } from "@/lib/notify";
import { cn } from "@/lib/utils";

const ART = {
  emerald: "/images/nfts/emerald",
  violet: "/images/nfts/violet",
  ivory: "/images/nfts/ivory",
  golden: "/images/nfts/golden",
};
const art = (key: keyof typeof ART, size: 512 | 1024 = 512) => `${ART[key]}-${size}.webp`;
const artSrcSet = (key: keyof typeof ART) => `${art(key)} 512w, ${art(key, 1024)} 1024w`;

/** Hero do Figma: desktop (450px, arte à direita) e mobile (card de 190px com duas artes). */
export function HomeHero() {
  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="relative hidden h-[450px] items-center justify-between overflow-hidden rounded-[24px] bg-linear-to-br from-surface-card to-surface-raised pl-10 md:flex"
      >
        <div className="flex max-w-[600px] flex-col items-end gap-11 py-10 pr-6">
          <div className="flex w-full flex-col gap-8">
            <div className="flex flex-col gap-1">
              <p className="text-14 leading-4 font-medium tracking-[1.4px]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="mt-2 text-32 leading-[1.4] font-bold lg:text-43 lg:leading-[70px]">
                SEJA DONO DO FUTURO
                <br />
                DA ARTE DIGITAL
              </h1>
              <p className="max-w-[557px] text-14 leading-6 text-text-secondary">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
                artistas e tenha uma parte da cultura da internet.
              </p>
            </div>
            <Link to="/" hash="catalogo" className={cn(buttonVariants(), "w-[140px] leading-5")}>
              EXPLORAR
            </Link>
          </div>
          <img src={dots} alt="" aria-hidden="true" width={40} height={8} />
        </div>
        <img
          src={art("emerald", 1024)}
          srcSet={artSrcSet("emerald")}
          sizes="450px"
          alt="Emerald Ape #042, macaco de óculos e jaqueta verde"
          width={450}
          height={450}
          fetchPriority="high"
          className="size-[450px] shrink-0 rounded-[24px] object-cover max-lg:size-[360px]"
        />
      </section>

      <section aria-labelledby="hero-title-mobile" className="relative h-[190px] overflow-hidden rounded-[12px] p-4 md:hidden">
        <img src={heroMaskMobile} alt="" aria-hidden="true" className="absolute inset-0 size-full" />
        <div className="relative flex h-full flex-col items-center gap-4">
          <div className="flex w-full flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-12 leading-4 font-medium">Bem-vindo à Kurio</p>
              <h1 id="hero-title-mobile" className="max-w-[190px] text-18 leading-[29px] font-bold">
                SEJA DONO DA CULTURA DIGITAL
              </h1>
              <p className="text-12 leading-[18px] text-text-secondary">Descubra NFTs selecionados de criadores do mundo todo.</p>
              <Link to="/" hash="catalogo" className="flex items-center gap-2 text-12 leading-[14px] font-bold text-text-accent">
                EXPLORAR
                <img src={mobileArrow} alt="" width={10} height={12} className="-rotate-90" />
              </Link>
            </div>
            <div className="relative size-[138px] shrink-0">
              <img
                src={art("emerald")}
                alt="Emerald Ape #042"
                width={138}
                height={138}
                fetchPriority="high"
                className="size-[138px] rounded-[16px] object-cover"
              />
              <img
                src={art("violet")}
                alt=""
                aria-hidden="true"
                width={58}
                height={58}
                className="absolute top-[88px] left-[14px] size-[58px] rounded-[16px] object-cover"
              />
            </div>
          </div>
          <img src={dots} alt="" aria-hidden="true" width={33} height={7} />
        </div>
      </section>
    </>
  );
}

/** "NFT em destaque" da barra lateral: leva ao detalhe real do NFT da oferta. */
export function FeaturedBanner() {
  return (
    <Link
      to="/nfts/$id"
      params={{ id: "sage-nomad-009" }}
      className="relative hidden h-[470px] w-[310px] flex-col gap-4 overflow-hidden bg-linear-to-b from-primary/10 to-primary/[0.03] pt-6 lg:flex"
    >
      <span className="px-5 text-24 leading-8 font-bold text-text-accent">NFT EM DESTAQUE</span>
      <span className="px-5 text-center text-22 leading-4 font-bold">OFERTA LIMITADA</span>
      <img
        src={art("violet")}
        alt="Sage Nomad #009 em oferta limitada"
        width={310}
        height={368}
        loading="lazy"
        className="h-[368px] w-full rounded-[22px] object-cover"
      />
      <span aria-hidden="true" className="absolute top-[299px] left-4 size-[22px] rounded-[7px] border-2 border-[#46a358] opacity-20" />
      <span aria-hidden="true" className="absolute top-[343px] left-[248px] size-[45px] rounded-[29px] bg-linear-[145deg] from-primary/30 from-46% to-primary/0" />
      <span aria-hidden="true" className="absolute top-[105px] left-[38px] size-[15px] rounded-[29px] bg-linear-[145deg] from-primary/30 from-46% to-primary/0" />
    </Link>
  );
}

const PROMOS = [
  {
    title: ["Lançamentos gênesis", "de edição limitada"],
    text: "Colecione edições escassas diretamente dos criadores antes da revelação pública.",
    image: "emerald" as const,
    search: { tab: "new" as const },
  },
  {
    title: ["Arte digital selecionada", "e muito mais"],
    text: "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.",
    image: "ivory" as const,
    search: { categories: "arte-digital" },
  },
];

/** Cards promocionais: "Explorar" aplica o filtro correspondente no catálogo. */
export function Promos() {
  return (
    <section aria-label="Destaques do mercado" className="hidden grid-cols-2 gap-7 md:grid">
      {PROMOS.map((promo) => (
        <article key={promo.title[0]} className="relative h-[250px] overflow-hidden rounded-[8px] bg-surface-card">
          <img src={art(promo.image)} alt="" aria-hidden="true" loading="lazy" className="absolute top-0 left-0 h-[250px] w-1/2 rounded-[18px] object-cover" />
          <div className="relative ml-auto flex h-full w-1/2 flex-col items-end justify-center gap-4 pr-[30px] text-right">
            <h2 className="text-18 leading-6 font-bold">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="max-w-[263px] text-14 leading-6 text-text-secondary">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              hash="catalogo"
              className={cn(buttonVariants(), "w-[140px] gap-4 text-14 font-medium")}
            >
              Explorar
              <img src={arrowRight} alt="" width={11} height={13} className="-rotate-90" />
            </Link>
          </div>
          <img src={promoMask} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
        </article>
      ))}
    </section>
  );
}

const POSTS = [
  { date: "12 de setembro", read: "6 min", title: "Como funciona a propriedade de NFTs", text: "Aprenda a colecionar, negociar e verificar ativos digitais.", image: "ivory" as const },
  { date: "13 de setembro", read: "2 min", title: "10 artistas digitais para acompanhar", text: "Conheça criadores que moldam a cultura digital.", image: "emerald" as const },
  { date: "15 de setembro", read: "3 min", title: "Raridade, atributos e procedência", text: "Entenda raridade, procedência, direitos autorais e utilidade.", image: "violet" as const },
  { date: "15 de setembro", read: "2 min", title: "Como proteger sua carteira", text: "Proteja sua carteira, seus ativos e sua identidade.", image: "golden" as const },
];

/** "Diário da Cunhagem": conteúdo editorial fora do escopo; "Ler mais" informa isso. */
export function Blog() {
  return (
    <section aria-labelledby="blog-title" className="hidden flex-col items-center gap-10 md:flex">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="blog-title" className="text-28 font-bold text-text-primary">
          Diário da Cunhagem
        </h2>
        <p className="text-14 text-text-secondary">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <div className="grid w-full grid-cols-2 gap-6 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col overflow-hidden rounded-[8px] bg-surface-card">
            <img src={art(post.image)} alt="" aria-hidden="true" loading="lazy" width={268} height={195} className="h-[195px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-12 leading-4 font-medium whitespace-pre-wrap text-text-secondary">{`${post.date}  |  Leitura de ${post.read}`}</p>
              <h3 className="text-16 font-bold text-text-primary">{post.title}</h3>
              <p className="text-12 leading-4 font-medium text-text-secondary">{post.text}</p>
              <button
                type="button"
                className="mt-auto flex w-fit gap-1 text-12 text-text-accent"
                onClick={() => notifyUnavailable("O conteúdo editorial")}
              >
                <span className="leading-[14px] font-bold">Ler mais</span>
                <span aria-hidden="true">→</span>
                <span className="sr-only">: {post.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
