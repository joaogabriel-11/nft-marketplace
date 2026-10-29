import { Link, useRouterState } from "@tanstack/react-router";
import homeIcon from "@/assets/icons/m-home.svg";
import heartIcon from "@/assets/icons/m-heart-tab.svg";
import scanIcon from "@/assets/icons/m-scan.svg";
import shopIcon from "@/assets/icons/m-shop.svg";
import fabBg from "@/assets/icons/m-tabbar-fab.svg";
import barBg from "@/assets/icons/m-tabbar-bg.svg";
import userIcon from "@/assets/icons/m-user.svg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCartCount } from "@/features/cart/queries";
import { useSession } from "@/features/auth/session";
import { useLogout } from "@/features/auth/use-auth-actions";
import { notifyUnavailable } from "@/lib/notify";
import { cn } from "@/lib/utils";

const ITEM = "grid size-11 place-items-center rounded-full";

/**
 * Barra inferior do Figma mobile. O fundo com recorte é o SVG original do arquivo.
 * Itens sem tela na entrega (favoritos em lista, leitor de QR) avisam que estão fora do escopo.
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });
  const count = useCartCount();
  const { user } = useSession();
  const logout = useLogout();

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 h-[126px] md:hidden">
      <img src={barBg} alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-[-7%] bottom-0 h-[155px] w-[114%] max-w-none" />
      <button
        type="button"
        onClick={() => notifyUnavailable("O leitor de QR code")}
        aria-label="Ler QR code de um NFT"
        className="absolute top-0 left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full"
      >
        <img src={fabBg} alt="" className="absolute inset-0" />
        <img src={scanIcon} alt="" width={27} height={24} className="relative" />
      </button>
      <ul className="absolute inset-x-0 bottom-0 flex h-[95px] items-center justify-between px-[7%] pb-4">
        <li>
          <Link to="/" className={ITEM} aria-label="Início" aria-current={pathname === "/" ? "page" : undefined}>
            <img src={homeIcon} alt="" width={16} height={17} className={cn(pathname !== "/" && "opacity-60 grayscale")} />
          </Link>
        </li>
        <li className="mr-auto ml-[9%]">
          <button type="button" className={ITEM} aria-label="Favoritos" onClick={() => notifyUnavailable("A lista de favoritos")}>
            <img src={heartIcon} alt="" width={20} height={18} />
          </button>
        </li>
        <li className="mr-[9%] ml-auto">
          <Link to="/carrinho" className={cn(ITEM, "relative")} aria-label={count ? `Carrinho, ${count} itens` : "Carrinho vazio"}>
            <img src={shopIcon} alt="" width={20} height={20} />
            {count > 0 && (
              <span aria-hidden="true" className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full border-2 border-ink bg-primary text-10 leading-3 font-medium text-ink">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={ITEM} aria-label={`Conta de ${user.displayName}`}>
                <img src={userIcon} alt="" width={20} height={20} />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top">
                <DropdownMenuLabel className="px-3 py-2 text-12 text-text-secondary">{user.displayName}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/perfil">Meu perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/perfil/carteiras">Carteiras</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => logout.mutate()}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" search={{ redirect: href }} className={ITEM} aria-label="Entrar">
              <img src={userIcon} alt="" width={20} height={20} />
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
