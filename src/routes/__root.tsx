import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-14 font-bold text-text-accent">Erro 404</p>
      <h1 className="text-28 font-bold">Página não encontrada</h1>
      <p className="text-14 leading-[22px] text-text-secondary">
        O endereço acessado não existe ou foi removido.
      </p>
      <Link
        to="/"
        className="rounded-md bg-primary px-6 py-3 text-14 font-bold text-ink hover:bg-primary-light"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
