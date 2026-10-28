/**
 * Estado local do checkout, sempre escopado por usuário (nunca vaza para outra conta):
 * - draft: o que foi digitado no pagamento (sobrevive a sessão expirada e refresh);
 * - attempt: a chave de idempotência da intenção de compra atual (cotação + carteira);
 * - pending: pedido criado e ainda não concluído, para retomar após refresh/reconexão.
 * Usa localStorage porque a retomada precisa sobreviver a fechar a aba.
 */
const key = (kind: "draft" | "attempt" | "pending", userId: string) => `kurio:checkout:${kind}:${userId}`;

function read<T>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storageKey: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage indisponível: o fluxo segue, só sem retomada.
  }
}

export interface CheckoutAttempt {
  quoteId: string;
  walletId: string;
  idempotencyKey: string;
}

export interface PendingOrder {
  orderId: string;
  createdAt: string;
}

export const checkoutStorage = {
  draft: {
    get: <T>(userId: string) => read<T>(key("draft", userId)),
    set: (userId: string, value: unknown) => write(key("draft", userId), value),
    clear: (userId: string) => write(key("draft", userId), null),
  },
  /**
   * A mesma cotação + carteira reaproveita a chave (clique repetido, timeout, refresh);
   * uma cotação nova é uma nova intenção e gera chave nova.
   */
  attemptFor(userId: string, quoteId: string, walletId: string): CheckoutAttempt {
    const current = read<CheckoutAttempt>(key("attempt", userId));
    if (current && current.quoteId === quoteId && current.walletId === walletId) return current;
    const attempt = { quoteId, walletId, idempotencyKey: crypto.randomUUID() };
    write(key("attempt", userId), attempt);
    return attempt;
  },
  clearAttempt: (userId: string) => write(key("attempt", userId), null),
  pending: {
    get: (userId: string) => read<PendingOrder>(key("pending", userId)),
    set: (userId: string, value: PendingOrder) => write(key("pending", userId), value),
    clear: (userId: string) => write(key("pending", userId), null),
  },
};
