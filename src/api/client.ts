import axios from "axios";
import { env } from "@/lib/env";
import { API_TIMEOUT_MS, HEADERS } from "./config";
import { toApiError, type ApiError } from "./errors";
import { guestCartStore, tokenStore } from "./storage";

/** Instância única usada por todas as chamadas REST. */
export const api = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
  // Arrays viajam como lista separada por vírgula (categories=a,b), o formato do contrato.
  paramsSerializer: { serialize: serializeParams },
});

function serializeParams(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    const guestCartId = guestCartStore.get();
    if (guestCartId) config.headers.set(HEADERS.guestCartId, guestCartId);
  }
  return config;
});

type UnauthorizedListener = (error: ApiError) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/**
 * A camada de sessão (features/auth) assina aqui para reagir a 401: limpar cache e
 * redirecionar ao login preservando o destino. O cliente HTTP não conhece rotas nem UI.
 */
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

api.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error);
  // 401 de uma requisição feita com token: a sessão local não vale mais.
  const sentToken = axios.isAxiosError(error) && error.config?.headers?.get?.("Authorization");
  if (apiError.isUnauthenticated && sentToken) {
    for (const listener of unauthorizedListeners) listener(apiError);
  }
  return Promise.reject(apiError);
});
