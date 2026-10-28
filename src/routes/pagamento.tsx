import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "@/features/auth/session";
import { CheckoutPage } from "@/features/checkout/checkout-page";

export const Route = createFileRoute("/pagamento")({
  // Privada: sem sessão vai ao login e volta para cá (o rascunho do formulário é preservado).
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location),
  component: CheckoutPage,
});
