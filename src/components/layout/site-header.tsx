import { Link, useRouterState } from "@tanstack/react-router";
import cartIcon from "@/assets/icons/cart.svg";
import logoutIcon from "@/assets/icons/logout.svg";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCartCount } from "@/features/cart/queries";
import { useSession } from "@/features/auth/session";
import { useLogout } from "@/features/auth/use-auth-actions";
import { notifyUnavailable } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { SearchDialog } from "./search-dialog";

type NavKey = "home" | "market";

/** "Início" ativo na home e telas de conta; "Mercado" no fluxo de compra (regra do Figma). */
function useActiveNav(): NavKey {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return ["/nfts", "/carrinho", "/pagamento", "/pedidos"].some((prefix) => pathname.startsWith(prefix))
    ? "market"
    : "home";
}

function NavItem({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("relative flex flex-col pb-3 text-16", active ? "font-bold text-text-accent" : "text-foreground")}>
      {children}
      {active && <span aria-hidden="true" className="absolute inset-x-0 -bottom-3 h-[3px] bg-primary" />}
    </span>
  );
}

export function SiteHeader({ divider = false }: { divider?: boolean }) {
  const active = useActiveNav();
  const count = useCartCount();
  const { user } = useSession();
  const logout = useLogout();
  const pathname = useRouterState({ select: (state) => state.location.href });

  return (
    <header className={cn("hidden md:block", divider && "border-b-[0.3px] border-foreground/40")}>
      <div className="flex items-start justify-between pb-3">
        <Link to="/" className="w-40 pt-2 text-14 font-bold tracking-[1.4px]" aria-label="Kurio, página inicial">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex gap-6 lg:gap-10">
          <Link to="/" aria-current={active === "home" ? "page" : undefined}>
            <NavItem active={active === "home"}>Início</NavItem>
          </Link>
          <Link to="/" hash="catalogo" aria-current={active === "market" ? "page" : undefined}>
            <NavItem active={active === "market"}>Mercado</NavItem>
          </Link>
          <button type="button" onClick={() => notifyUnavailable("A área de criadores")}>
            <NavItem active={false}>Criadores</NavItem>
          </button>
          <button type="button" onClick={() => notifyUnavailable("O conteúdo editorial")}>
            <NavItem active={false}>Aprenda</NavItem>
          </button>
        </nav>
        <div className="flex items-center gap-5 lg:gap-7">
          <SearchDialog />
          <Link
            to="/carrinho"
            className="relative grid size-8 place-items-center"
            aria-label={count ? `Carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Carrinho vazio"}
          >
            <img src={cartIcon} alt="" width={24} height={24} />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full border-2 border-ink bg-primary px-0.5 text-10 leading-3 font-medium text-ink"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-[35px] items-center gap-2 rounded-[6px] border border-primary px-3 text-14 text-text-accent"
                aria-label={`Conta de ${user.displayName}`}
              >
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-primary text-12 font-bold text-ink">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-28 truncate">{user.displayName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="px-3 py-2 text-12 text-text-secondary">{user.email}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => logout.mutate()}>
                  <img src={logoutIcon} alt="" width={18} height={17} className="invert" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              search={{ redirect: pathname }}
              className={cn(buttonVariants({ size: "sm" }), "w-[100px] gap-1 font-medium text-16")}
            >
              <img src={logoutIcon} alt="" width={18} height={17} />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
