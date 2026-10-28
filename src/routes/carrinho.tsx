import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "@/features/cart/cart-page";

// Aberta para visitante: o carrinho de visitante vira o do usuário ao autenticar.
export const Route = createFileRoute("/carrinho")({
  component: CartPage,
});
