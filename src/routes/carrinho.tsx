import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/features/cart/queries";
import { formatEth } from "@/lib/format";

// Versão provisória (Bloco 2): confirma o "COMPRAR" de ponta a ponta.
// A tela do Figma, com edição de quantidades, cupom e checkout, chega no Bloco 3.
export const Route = createFileRoute("/carrinho")({
  component: CartRoute,
});

function CartRoute() {
  const { data: cart, isPending } = useCart();
  return (
    <section aria-labelledby="cart-title" className="flex flex-col gap-6">
      <h1 id="cart-title" className="text-28 font-bold">
        Carrinho
      </h1>
      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : !cart || cart.items.length === 0 ? (
        <p className="text-14 text-text-secondary">Seu carrinho está vazio.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 rounded-[6px] bg-surface-card p-4 text-14">
              <span>
                {item.name} · {item.editionLabel} · {item.quantity}×
              </span>
              <strong className="text-text-accent">{formatEth(item.lineTotalEth)}</strong>
            </li>
          ))}
        </ul>
      )}
      {cart && cart.items.length > 0 && (
        <p className="text-16">
          Total: <strong className="text-text-accent">{formatEth(cart.totals.totalEth)}</strong>
        </p>
      )}
      <Link to="/" hash="catalogo" className={buttonVariants({ variant: "outline", className: "w-fit" })}>
        Continuar explorando
      </Link>
    </section>
  );
}
