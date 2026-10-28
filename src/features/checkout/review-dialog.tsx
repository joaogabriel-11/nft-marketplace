import { useEffect, useState } from "react";
import type { Network, Quote, QuoteOutdatedDetails, WalletType } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TotalsList } from "@/features/cart/cart-page";
import { formatEth, NETWORK_LABELS, shortAddress, WALLET_TYPE_LABELS } from "@/lib/format";

interface ReviewDialogProps {
  open: boolean;
  quote: Quote | null;
  /** Mudanças detectadas pela API na revalidação (409). Exigem nova confirmação. */
  changes: QuoteOutdatedDetails["changes"];
  wallet: { type: WalletType; address: string; network: Network };
  submitting: boolean;
  /** Um evento em tempo real mudou um item desta cotação: confirmar exige atualizar antes. */
  stale: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  onBackToCart: () => void;
}

function useSecondsLeft(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000)) : 0;
}

/** Revisão antes do envio: o usuário confirma exatamente a cotação que a API vai validar. */
export function ReviewDialog({
  open,
  quote,
  changes,
  wallet,
  submitting,
  stale,
  refreshing,
  onRefresh,
  error,
  onConfirm,
  onClose,
  onBackToCart,
}: ReviewDialogProps) {
  const secondsLeft = useSecondsLeft(quote?.expiresAt);
  const expired = !!quote && secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-32px)] max-w-[578px] overflow-y-auto rounded-[8px] p-6 md:p-9"
        closeLabel="Fechar revisão"
        onInteractOutside={(event) => submitting && event.preventDefault()}
        onEscapeKeyDown={(event) => submitting && event.preventDefault()}
      >
        <DialogTitle className="text-20 font-bold">{changes.length ? "Os valores mudaram" : "Revise sua compra"}</DialogTitle>
        <DialogDescription className="mt-2 text-13 text-text-secondary">
          {changes.length
            ? "Antes de pagar, confira as alterações abaixo. A compra só segue com a sua nova confirmação."
            : "Confira itens, carteira e total. O pagamento usa exatamente esta cotação."}
        </DialogDescription>

        {changes.length > 0 && (
          <ul role="alert" className="mt-4 flex flex-col gap-2 rounded-[6px] border border-coral/70 bg-coral/10 p-4 text-13">
            {changes.map((change, index) => (
              <li key={`${change.type}-${change.editionId ?? index}`}>• {change.message}</li>
            ))}
          </ul>
        )}

        {stale && quote && (
          <p role="alert" className="mt-4 rounded-[6px] border border-primary/70 bg-primary/10 p-4 text-13">
            O preço ou a disponibilidade de um item mudou agora há pouco. Atualize a cotação para ver os novos valores antes de pagar.
          </p>
        )}

        {quote ? (
          <>
            <ul aria-label="Itens da cotação" className="mt-6 flex flex-col gap-3">
              {quote.items.map((item) => (
                <li key={item.editionId} className="flex items-center gap-3 bg-surface-raised p-1 pr-4">
                  <img src={item.imageUrl} alt="" width={56} height={56} className="size-14 rounded-[8px] object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-15 font-bold">{item.name}</span>
                    <span className="text-13 text-secondary">
                      Edição {item.editionLabel} · {formatEth(item.unitPriceEth)} cada
                    </span>
                  </div>
                  <span className="text-14 text-text-secondary">(x {item.quantity})</span>
                  <span className="text-16 font-bold text-text-accent">{formatEth(item.lineTotalEth)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <TotalsList totals={quote.totals} compact />
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-[6px] border border-border p-4 text-13">
              <div>
                <dt className="text-text-secondary">Carteira</dt>
                <dd>{WALLET_TYPE_LABELS[wallet.type]}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Rede</dt>
                <dd>{NETWORK_LABELS[wallet.network]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-secondary">Endereço</dt>
                <dd title={wallet.address}>{shortAddress(wallet.address)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-12 text-text-secondary" aria-live="polite">
              {expired ? "Esta cotação expirou. Ao confirmar, os valores serão revalidados." : `Cotação válida por ${minutes}:${seconds}.`}
            </p>
          </>
        ) : (
          <p className="mt-6 text-14 text-text-secondary">Não é possível comprar o carrinho como está. Ajuste os itens no carrinho.</p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-[6px] border border-error/60 bg-error/10 px-4 py-3 text-13">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {quote ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Voltar e editar
              </Button>
              {stale ? (
                <Button onClick={onRefresh} disabled={refreshing}>
                  {refreshing ? "Atualizando cotação…" : "Atualizar cotação"}
                </Button>
              ) : (
                <Button onClick={onConfirm} disabled={submitting}>
                  {submitting ? "Processando pagamento…" : changes.length ? "Confirmar novos valores" : "Confirmar pagamento"}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={onBackToCart}>Voltar ao carrinho</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
