import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/auth-screen";
import { authSearchSchema } from "@/features/auth/search";
import { safeRedirect, sessionQueryOptions } from "@/features/auth/session";

export const Route = createFileRoute("/cadastro")({
  validateSearch: authSearchSchema.pick({ redirect: true }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: function RegisterRoute() {
    const { redirect: target } = Route.useSearch();
    return <AuthScreen mode="register" redirect={target} />;
  },
});
