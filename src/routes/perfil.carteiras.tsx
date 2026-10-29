import { createFileRoute } from "@tanstack/react-router";
import { WalletsPage } from "@/features/wallets/wallets-page";

export const Route = createFileRoute("/perfil/carteiras")({
  component: WalletsPage,
});
