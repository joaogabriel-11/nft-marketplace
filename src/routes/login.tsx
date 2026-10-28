import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/auth-screen";
import { authSearchSchema } from "@/features/auth/search";
import { safeRedirect, sessionQueryOptions } from "@/features/auth/session";

export const Route = createFileRoute("/login")({
  validateSearch: authSearchSchema,
  // Já autenticado: não faz sentido mostrar o login; segue para o destino.
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: function LoginRoute() {
    const { redirect: target, reason } = Route.useSearch();
    return <AuthScreen mode="login" redirect={target} reason={reason} />;
  },
});
