import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { Order } from "@/api/contracts";
import { isApiError } from "@/api/errors";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEth, NETWORK_LABELS, shortAddress, WALLET_TYPE_LABELS } from "@/lib/format";
import { errorMessage } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useOrder } from "./queries";

const EXPLORER_LABELS = { ethereum: "Ver no Etherscan", polygon: "Ver no Polygonscan", solana: "Ver no Solscan" } as const;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Recibo/estado do pedido. Só mostra "confirmado" quando a API diz que está confirmado. */
export function OrderPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);

  if (order.isPending) return <OrderSkeleton />;
  if (order.isError) {
    const forbidden = isApiError(order.error) && (order.error.status === 403 || order.error.status === 404);
    return (
      <Card>
        <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <h1 className="text-20 font-bold">{forbidden ? "Pedido não encontrado" : "Não conseguimos carregar o pedido"}</h1>
          <p className="text-14 text-text-secondary">
            {forbidden ? "Este pedido não existe ou pertence a outra conta." : errorMessage(order.error)}
          </p>
          {forbidden ? (
            <Link to="/" className={buttonVariants()}>
              Voltar ao início
            </Link>
          ) : (
            <Button onClick={() => void order.refetch()}>Tentar novamente</Button>
          )}
        </div>
      </Card>
    );
  }
  return <OrderReceipt order={order.data} reconnecting={order.isRefetchError} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center md:py-10">
      <article className="w-full max-w-[578px] overflow-hidden rounded-[8px] bg-surface-card shadow-[0_0_40px_rgba(10,6,4,0.5)]">{children}</article>
    </div>
  );
}

function OrderReceipt({ order, reconnecting }: { order: Order; reconnecting: boolean }) {
  const status = {
    pending: { icon: Clock3, title: "Processando pagamento", tone: "text-text-accent" },
    confirmed: { icon: CheckCircle2, title: "Seus NFTs agora estão na sua carteira", tone: "text-success" },
    rejected: { icon: XCircle, title: "Pagamento recusado", tone: "text-coral" },
  }[order.status];
  const Icon = status.icon;
  const meta = [
    { label: "ID da transação", value: order.txHash ? shortAddress(order.txHash) : "Aguardando", title: order.txHash ?? undefined },
    { label: "Data", value: dateFormat.format(new Date(order.createdAt)) },
    { label: "Total", value: formatEth(order.totals.totalEth) },
    { label: "Carteira", value: WALLET_TYPE_LABELS[order.wallet.type] },
  ];

  return (
    <Card>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <Icon aria-hidden="true" className={cn("size-20", status.tone, order.status === "pending" && "motion-safe:animate-pulse")} strokeWidth={1.4} />
        <h1 className="text-16 leading-4 font-bold">{status.title}</h1>
        <p role="status" aria-live="polite" className="text-13 text-text-secondary">
          {order.status === "pending" &&
            (reconnecting
              ? "Conexão instável. Assim que voltar, buscamos o estado do pedido — nenhuma nova cobrança será feita."
              : "Aguardando a confirmação da rede. Você pode sair desta tela: o pedido continua sendo processado.")}
          {order.status === "confirmed" && `Transação confirmada na ${NETWORK_LABELS[order.network]}. A propriedade foi registrada na sua carteira.`}
          {order.status === "rejected" && `${order.failureReason ?? "O pagamento não foi aprovado."} Seus itens continuam no carrinho.`}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-y-3 border-y border-border px-6 py-4 text-left md:grid-cols-[auto_auto_auto_auto] md:justify-between md:px-9">
        {meta.map((item, index) => (
          <div key={item.label} className={cn("flex min-w-0 flex-col gap-0 pr-3", index > 0 && "md:border-l md:border-border md:pl-4")}>
            <dt className="text-12 leading-4 text-text-secondary">{item.label}</dt>
            <dd className="text-14 leading-5 font-bold" title={item.title}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="order-items-title" className="flex flex-col gap-3 px-6 pt-5 pb-6 md:px-11">
        <h2 id="order-items-title" className="text-16 leading-4 font-bold">
          Detalhes da transação
        </h2>
        <div aria-hidden="true" className="flex justify-between border-b-[0.3px] border-foreground/40 pb-3 text-14 leading-4">
          <span className="font-bold">NFTs</span>
          <span className="flex gap-12">
            <span>Edições</span>
            <span>Subtotal</span>
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.editionId} className="flex items-center gap-3">
              <img src={item.imageUrl} alt="" width={70} height={70} className="size-[70px] rounded-[8px] object-cover" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 leading-4">
                <span className="truncate text-15 font-bold">{item.name}</span>
                <span className="text-13 text-secondary">
                  ID do token: {item.tokenId} · {item.editionLabel}
                </span>
              </span>
              <span className="text-14 text-text-secondary">(x {item.quantity})</span>
              <span className="w-[90px] text-right text-15 font-bold text-text-accent">{formatEth(item.lineTotalEth)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto flex w-full max-w-[321px] flex-col gap-2 border-t-[0.3px] border-foreground/30 pt-3 text-14">
          {order.coupon && (
            <div className="flex justify-between">
              <dt>Desconto ({order.coupon.code})</dt>
              <dd>(-) {formatEth(order.totals.discountEth)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd>{formatEth(order.totals.networkFeeEth)}</dd>
          </div>
          <div className="flex justify-between text-16 font-bold">
            <dt>Total</dt>
            <dd className="text-text-accent">{formatEth(order.totals.totalEth)}</dd>
          </div>
        </dl>
        <p className="text-12 text-text-secondary">
          Carteira {shortAddress(order.wallet.address)} · {NETWORK_LABELS[order.network]} · Referências de transação simuladas.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {order.status === "confirmed" && order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>
              {EXPLORER_LABELS[order.network]}
              <span className="sr-only"> (abre em nova aba, link simulado)</span>
            </a>
          )}
          {order.status === "rejected" && (
            <>
              <Link to="/carrinho" className={buttonVariants({ variant: "outline" })}>
                Voltar ao carrinho
              </Link>
              <Link to="/pagamento" className={buttonVariants()}>
                Tentar novamente
              </Link>
            </>
          )}
          {order.status !== "rejected" && (
            <Link to="/" hash="catalogo" className={buttonVariants({ variant: "outline" })}>
              Continuar explorando
            </Link>
          )}
        </div>
      </section>
    </Card>
  );
}

function OrderSkeleton() {
  return (
    <Card>
      <div aria-busy="true" className="flex flex-col items-center gap-4 p-8">
        <p role="status" className="sr-only">
          Carregando pedido…
        </p>
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Card>
  );
}
