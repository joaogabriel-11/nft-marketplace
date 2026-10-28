/**
 * Credenciais do cliente persistidas no navegador: token da sessão e id do carrinho de visitante.
 * localStorage permite recuperar a sessão após refresh (requisito); o token é opaco e expira no servidor.
 */
const TOKEN_KEY = "kurio:token";
const GUEST_CART_KEY = "kurio:guest-cart";

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage bloqueado: segue só em memória.
  }
}

let token = read(TOKEN_KEY);

export const tokenStore = {
  get: () => token,
  set(next: string | null) {
    if (next === token) return;
    token = next;
    write(TOKEN_KEY, next);
    for (const listener of listeners) listener(next);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const guestCartStore = {
  get: () => read(GUEST_CART_KEY),
  set: (id: string | null) => write(GUEST_CART_KEY, id),
};
