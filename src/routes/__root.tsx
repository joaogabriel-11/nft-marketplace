import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/session";
import { RealtimeBridge } from "@/lib/realtime/realtime-bridge";
import { cn } from "@/lib/utils";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // A sessão salva é recuperada antes da primeira tela (refresh mantém o usuário logado).
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null),
  component: RootLayout,
  notFoundComponent: NotFound,
});

/** Telas que no Figma usam o header com divisória e a barra inferior no mobile. */
const DIVIDER_ROUTES = ["/", "/login", "/cadastro"];

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Frames mobile do fluxo de compra (detalhe, carrinho, pagamento) não têm a barra inferior.
  const hideTabBar = ["/nfts/", "/carrinho", "/pagamento", "/pedidos/"].some((prefix) => pathname.startsWith(prefix));

  return (
    <>
      <a
        href="#conteudo"
        // A âncora sozinha rola, mas não move o foco do teclado no Chrome: o main recebe o foco.
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("conteudo")?.focus();
        }}
        className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-[6px] bg-primary px-4 py-2 text-14 font-bold text-ink focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      {/* Figma: 32px entre header e conteúdo; 96px entre o conteúdo e o footer. */}
      <div className="mx-auto flex min-h-dvh w-full max-w-[1248px] flex-col gap-6 px-4 pt-6 md:gap-8 md:px-6 [&>footer]:lg:mt-16">
        <SiteHeader divider={DIVIDER_ROUTES.includes(pathname)} />
        <main id="conteudo" tabIndex={-1} className={cn("flex-1 outline-none", !hideTabBar && "pb-[140px] md:pb-0")}>
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      {!hideTabBar && <MobileTabBar />}
      <RealtimeBridge />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!bg-surface-raised !border-border !text-foreground !font-sans",
            description: "!text-text-secondary",
          },
        }}
      />
    </>
  );
}

function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="text-14 font-bold text-text-accent">Erro 404</p>
      <h1 className="text-28 font-bold">Página não encontrada</h1>
      <p className="text-14 leading-[22px] text-text-secondary">O endereço acessado não existe ou foi removido.</p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </section>
  );
}
