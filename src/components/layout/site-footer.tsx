import { useState, type FormEvent } from "react";
import facebook from "@/assets/icons/facebook.svg";
import instagram from "@/assets/icons/instagram.svg";
import linkedin from "@/assets/icons/linkedin.svg";
import twitter from "@/assets/icons/twitter.svg";
import youtube from "@/assets/icons/youtube.svg";
import { Input } from "@/components/ui/input";
import { notifyUnavailable } from "@/lib/notify";

const FEATURES = [
  { letter: "W", title: "Segurança da carteira", text: "Proteja sua carteira e colecione arte digital verificada com confiança." },
  { letter: "C", title: "Criadores em destaque", text: "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede." },
  { letter: "D", title: "Alertas de lançamentos", text: "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado." },
];

const LINK_COLUMNS = [
  { title: "Meu perfil", links: ["Meu perfil", "Minha coleção", "Atividade", "Estúdio do criador", "Lista de interesse"] },
  { title: "Central de ajuda", links: ["Central de ajuda", "Como comprar NFTs", "Carteira e segurança", "Política do mercado", "Denunciar item"] },
  { title: "Coleções", links: ["Arte digital", "Fotografia", "Música", "Arte 3D", "Utilidade"] },
];

const SOCIAL = [
  { icon: facebook, label: "Facebook", href: "https://www.facebook.com" },
  { icon: instagram, label: "Instagram", href: "https://www.instagram.com" },
  { icon: twitter, label: "X (Twitter)", href: "https://x.com" },
  { icon: linkedin, label: "LinkedIn", href: "https://www.linkedin.com" },
  { icon: youtube, label: "YouTube", href: "https://www.youtube.com" },
];

/** Footer do Figma (desktop/tablet). Links editoriais estão fora do escopo e avisam isso. */
export function SiteFooter() {
  const [email, setEmail] = useState("");

  function subscribe(event: FormEvent) {
    event.preventDefault();
    notifyUnavailable("A newsletter");
  }

  return (
    <footer className="hidden md:block">
      <div className="bg-surface-card p-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3 px-4 lg:border-r lg:border-primary">
              <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-24 font-bold text-ink">
                {feature.letter}
              </span>
              <h2 className="text-17 leading-4 font-bold">{feature.title}</h2>
              <p className="max-w-[204px] text-14 leading-[22px] text-text-secondary">{feature.text}</p>
            </div>
          ))}
          <form onSubmit={subscribe} className="flex flex-col gap-4 px-4">
            <h2 className="text-18 leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
            <div className="flex h-10 overflow-hidden rounded-[6px] bg-surface-dark shadow-[0_0_10px_rgba(10,6,4,0.45)]">
              <label htmlFor="newsletter-email" className="sr-only">
                Seu e-mail
              </label>
              <Input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="digite seu e-mail..."
                className="h-10 rounded-none border-0 px-3"
              />
              <button type="submit" className="w-[85px] shrink-0 bg-primary text-18 font-bold text-ink">
                Enviar
              </button>
            </div>
            <p className="text-13 leading-[22px] text-text-secondary">
              Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
            </p>
          </form>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-[92px] gap-y-3 bg-surface-dark px-8 py-6 text-14">
        <span className="flex-1 font-bold tracking-[1.4px]">KURIO</span>
        <p className="flex-1 leading-[22px]">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="flex-1 leading-[22px] hover:text-text-accent">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="w-[228px] leading-[22px] hover:text-text-accent">
          +55 11 4002 8922
        </a>
      </div>
      <div className="bg-surface-card p-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
          {LINK_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
              <h2 className="text-18 leading-4 font-bold">{column.title}</h2>
              <ul className="text-14 leading-[30px]">
                {column.links.map((link) => (
                  <li key={link}>
                    <button type="button" className="hover:text-text-accent" onClick={() => notifyUnavailable(link)}>
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <h2 className="text-18 leading-4 font-bold">Redes sociais</h2>
              <ul className="flex gap-2.5">
                {SOCIAL.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noreferrer" aria-label={`${item.label} (abre em nova aba)`}>
                      <img src={item.icon} alt="" width={32} height={32} className="size-[30px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-18 leading-4 font-bold">Carteiras compatíveis</h2>
              <p className="rounded-[6px] border border-border-soft bg-surface-dark px-2 py-2 text-center text-9 font-bold tracking-[0.1px] whitespace-pre text-text-accent">
                {"METAMASK  •  WALLETCONNECT  •  COINBASE"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="py-1.5 text-center text-14 leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}
