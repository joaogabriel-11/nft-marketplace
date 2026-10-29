import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Download, Heart, LogOut, ShoppingBag, TriangleAlert, User, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLogout } from "@/features/auth/use-auth-actions";
import { notifyUnavailable } from "@/lib/notify";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: "/perfil" | "/perfil/carteiras";
}

/** Barra lateral do Figma (Perfil e Carteiras). Itens sem tela na entrega avisam isso. */
const ITEMS: NavItem[] = [
  { label: "Dados do perfil", icon: User, to: "/perfil" },
  { label: "Carteiras", icon: Wallet, to: "/perfil/carteiras" },
  { label: "Atividade", icon: ShoppingBag },
  { label: "Lista de interesse", icon: Heart },
  { label: "Ofertas", icon: Activity },
  { label: "Downloads", icon: Download },
  { label: "Suporte", icon: TriangleAlert },
];

const ITEM = "flex h-[45px] w-full items-center gap-3 rounded-[4px] px-4 text-15 leading-[45px]";

export function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const logout = useLogout();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-7">
      <nav aria-label="Minha conta" className="lg:w-[310px] lg:shrink-0">
        <p className="hidden px-2.5 py-2.5 text-16 leading-4 font-bold lg:block">Meu perfil</p>
        {/* Mobile/tablet: as duas telas da conta viram abas no topo. */}
        <ul className="flex gap-2 overflow-x-auto lg:hidden">
          {ITEMS.filter((item) => item.to).map((item) => (
            <li key={item.label}>
              <Link
                to={item.to!}
                activeOptions={{ exact: true }}
                className="block rounded-full border border-border px-4 py-2 text-14 whitespace-nowrap data-[status=active]:border-primary data-[status=active]:text-text-accent"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="hidden flex-col lg:flex">
          {ITEMS.map(({ label, icon: Icon, to }) => (
            <li key={label}>
              {to ? (
                <Link
                  to={to}
                  activeOptions={{ exact: true }}
                  aria-current={pathname === to ? "page" : undefined}
                  className={cn(ITEM, pathname === to ? "text-text-accent" : "text-foreground hover:bg-surface-card")}
                >
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
                  {label}
                </Link>
              ) : (
                <button type="button" className={cn(ITEM, "text-foreground hover:bg-surface-card")} onClick={() => notifyUnavailable(label)}>
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
                  {label}
                </button>
              )}
            </li>
          ))}
          <li className="mt-0 border-t-[0.3px] border-foreground/40">
            <button type="button" className={cn(ITEM, "h-10 text-text-accent font-bold")} onClick={() => logout.mutate()}>
              <LogOut aria-hidden="true" className="size-5" strokeWidth={1.6} />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
