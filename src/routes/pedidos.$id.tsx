import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "@/features/auth/session";
import { OrderPage } from "@/features/checkout/order-page";

export const Route = createFileRoute("/pedidos/$id")({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location),
  component: function OrderRoute() {
    const { id } = Route.useParams();
    return <OrderPage orderId={id} />;
  },
});
