import { Link } from "@tanstack/react-router";
import { useSession } from "@/features/auth/session";
import { checkoutStorage } from "./storage";

/** Pedido criado e ainda não concluído (refresh, aba fechada, queda de conexão): oferece retomar. */
export function PendingOrderBanner() {
  const { user } = useSession();
  const pending = user ? checkoutStorage.pending.get(user.id) : null;
  if (!pending) return null;
  return (
    <p role="status" className="flex flex-wrap items-center gap-3 rounded-[6px] border border-primary/60 bg-primary/10 px-4 py-3 text-14">
      Você tem um pedido em processamento.
      <Link to="/pedidos/$id" params={{ id: pending.orderId }} className="font-bold text-text-accent underline-offset-4 hover:underline">
        Acompanhar pedido
      </Link>
    </p>
  );
}
