import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountLayout } from "@/features/account/account-layout";
import { requireSession } from "@/features/auth/session";

// Área da conta: privada; sem sessão vai ao login e volta para a mesma tela.
export const Route = createFileRoute("/perfil")({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location),
  component: function AccountRoute() {
    return (
      <AccountLayout>
        <Outlet />
      </AccountLayout>
    );
  },
});
